import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SignupDocument } from '../authentication/signup.schema';
import { ChatGateway } from '../chat/chat.gateway';
import { RoutingService } from '../common/services/routing.service';
import { RateHelpRequestDto } from '../ratings/dto/rate-help-request.dto';
import { RatingsService } from '../ratings/ratings.service';
import { VolunteerDocument } from '../volunteer/volunteer.schema';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateSosRequestDto } from './dto/create-sos-request.dto';
import { HelpRequestDocument } from './help-request.schema';

/** Default radius in kilometres for nearby-volunteer queries. */
const NEARBY_RADIUS_KM = parseInt(process.env.NEARBY_RADIUS_KM ?? '10', 10);

/** Wider broadcast radius used for SOS requests. */
const SOS_RADIUS_KM = parseInt(process.env.SOS_RADIUS_KM ?? '20', 10);

/** Help requests auto-expire after this many hours. */
const TTL_HOURS = 24;

/** SOS requests never expire — keep them alive long enough to outlive the TTL index. */
const SOS_TTL_DAYS = 30;

/**
 * Escalation ladder for unaccepted SOS requests (lazy, checked on fetch):
 * [afterMinutes, broadcastRadiusKm]
 */
const SOS_ESCALATION_STEPS = [
    { afterMinutes: 3, radiusKm: 25 },
    { afterMinutes: 10, radiusKm: 40 },
    { afterMinutes: 20, radiusKm: 60 },
];

@Injectable()
export class HelpRequestsService {
    constructor(
        @InjectModel('HelpRequest') private helpRequestModel: Model<HelpRequestDocument>,
        @InjectModel('Signup') private signupModel: Model<SignupDocument>,
        @InjectModel('Volunteer') private volunteerModel: Model<VolunteerDocument>,
        private readonly chatGateway: ChatGateway,
        private readonly ratingsService: RatingsService,
        private readonly routingService: RoutingService,
    ) {}

    // ──────────────────────────────────────────────
    // CREATE
    // ──────────────────────────────────────────────

    /**
     * Create a new help request and return it along with a list of
     * nearby verified volunteers who should be notified.
     */
    async createRequest(
        userId: string,
        dto: CreateHelpRequestDto,
        radiusKm: number = NEARBY_RADIUS_KM,
    ) {
        const location = {
            type: 'Point' as const,
            coordinates: [dto.longitude, dto.latitude], // GeoJSON: [lng, lat]
        };

        const isSos = (dto as any).isSos === true;
        const expiresAt = isSos
            ? new Date(Date.now() + SOS_TTL_DAYS * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

        const created = new this.helpRequestModel({
            userId: new Types.ObjectId(userId),
            title: dto.title,
            category: dto.category,
            subCategory: dto.subCategory,
            description: dto.description,
            image: dto.image,
            mediaUrls: dto.mediaUrls ?? [],
            locationName: dto.locationName,
            isSos,
            location,
            status: 'open',
            notifiedCount: 0,
            escalationLevel: 0,
            expiresAt,
        });

        const saved = await created.save();

        // Find nearby verified volunteers (async, non-blocking for the response)
        const nearbyVolunteers = await this.findNearbyVolunteers(
            dto.longitude,
            dto.latitude,
            radiusKm,
            userId, // exclude the requester themselves
        );

        const nearbyOnlineVolunteers = nearbyVolunteers.filter((volunteer: any) => volunteer.isOnline);
        const notified = this.chatGateway.notifyUsers(
            nearbyOnlineVolunteers.map((volunteer: any) => volunteer._id.toString()),
            'new_help_request',
            {
                _id: saved._id,
                title: saved.title,
                category: saved.category,
                subCategory: saved.subCategory,
                description: saved.description,
                image: saved.image,
                mediaUrls: saved.mediaUrls,
                location: saved.location,
                locationName: saved.locationName,
                isSos: saved.isSos,
            },
        );

        // Persist how many volunteers were notified (used by the SOS status card)
        await this.helpRequestModel
            .updateOne({ _id: saved._id }, { $set: { notifiedCount: notified } })
            .exec();
        saved.notifiedCount = notified;

        return { request: saved, nearbyVolunteers, nearbyOnlineVolunteers, notified };
    }

    async createSosRequest(userId: string, dto: CreateSosRequestDto) {
        // One active SOS per user — return the existing one instead of duplicating
        const existing = await this.helpRequestModel
            .findOne({
                userId: new Types.ObjectId(userId),
                isSos: true,
                status: { $in: ['open', 'accepted'] },
            })
            .populate('acceptedBy', 'username email role')
            .exec();

        if (existing) {
            return {
                request: existing,
                alreadyActive: true,
                nearbyVolunteers: [],
                nearbyOnlineVolunteers: [],
                notified: 0,
            };
        }

        const request = await this.createRequest(
            userId,
            {
                title: dto.title,
                category: 'SOS',
                subCategory: dto.title,
                description: dto.title,
                locationName: dto.locationName,
                latitude: dto.latitude,
                longitude: dto.longitude,
                isSos: true,
            } as CreateHelpRequestDto & { isSos: boolean },
            SOS_RADIUS_KM,
        );

        return { ...request, alreadyActive: false };
    }

    /**
     * Cancel the requester's active SOS and notify volunteers in the
     * original broadcast radius so the card disappears from their lists.
     */
    async cancelSos(userId: string) {
        const request = await this.helpRequestModel
            .findOneAndUpdate(
                {
                    userId: new Types.ObjectId(userId),
                    isSos: true,
                    status: { $in: ['open'] },
                },
                { $set: { status: 'cancelled' } },
                { new: true },
            )
            .populate('acceptedBy', 'username email role')
            .exec();

        if (!request) {
            throw new BadRequestException('No active SOS to cancel');
        }

        const coords = request.location?.coordinates;
        if (coords) {
            const nearby = await this.findNearbyVolunteers(
                coords[0],
                coords[1],
                SOS_RADIUS_KM,
            );
            this.chatGateway.notifyUsers(
                nearby.filter((v: any) => v.isOnline).map((v: any) => v._id.toString()),
                'help_request_cancelled',
                { requestId: request._id },
            );
        }

        return request;
    }

    /**
     * Lazy SOS escalation ladder. For every open SOS older than the step
     * threshold, re-broadcast to a wider radius and (at the final step)
     * alert admins. Runs on request fetches, so it does not depend on a
     * background cron that would never fire on a sleeping instance.
     */
    async checkSosEscalations() {
        const openSos = await this.helpRequestModel
            .find({ isSos: true, status: 'open' })
            .exec();

        for (const request of openSos as any[]) {
            const coords = request.location?.coordinates;
            if (!coords) continue;

            const ageMinutes =
                (Date.now() - new Date(request.createdAt).getTime()) / 60000;
            const level = request.escalationLevel ?? 0;
            if (level >= SOS_ESCALATION_STEPS.length) continue;

            const step = SOS_ESCALATION_STEPS[level];
            if (ageMinutes < step.afterMinutes) continue;

            const volunteers = await this.findNearbyVolunteers(
                coords[0],
                coords[1],
                step.radiusKm,
            );
            const online = volunteers.filter((v: any) => v.isOnline);
            const notified = this.chatGateway.notifyUsers(
                online.map((v: any) => v._id.toString()),
                'new_help_request',
                {
                    _id: request._id,
                    title: request.title,
                    category: request.category,
                    subCategory: request.subCategory,
                    description: request.description,
                    location: request.location,
                    locationName: request.locationName,
                    isSos: true,
                    escalated: true,
                },
            );

            const isFinalStep = level >= SOS_ESCALATION_STEPS.length - 1;
            if (isFinalStep) {
                const admins = await this.signupModel
                    .find({ role: 'admin' })
                    .select('_id')
                    .exec();
                this.chatGateway.notifyUsers(
                    admins.map((a: any) => a._id.toString()),
                    'sos_escalation',
                    {
                        requestId: request._id,
                        message: `SOS ${request._id} still unaccepted after ${Math.round(ageMinutes)} minutes`,
                        location: request.location,
                    },
                );
            }

            await this.helpRequestModel
                .updateOne(
                    { _id: request._id },
                    {
                        $set: { escalationLevel: level + 1, lastEscalatedAt: new Date() },
                        $inc: { notifiedCount: notified },
                    },
                )
                .exec();
        }
    }

    // ──────────────────────────────────────────────
    // QUERIES
    // ──────────────────────────────────────────────

    /**
     * Find verified volunteers within `radiusKm` of a given point.
     * Uses MongoDB $geoNear aggregation to include distance in results.
     */
    async findNearbyVolunteers(
        longitude: number,
        latitude: number,
        radiusKm: number = NEARBY_RADIUS_KM,
        excludeUserId?: string,
        onlineOnly = false,
    ) {
        const geoNearQuery: any = {
            role: 'volunteer',
            'location.type': 'Point',
        };

        if (excludeUserId && Types.ObjectId.isValid(excludeUserId)) {
            geoNearQuery._id = { $ne: new Types.ObjectId(excludeUserId) };
        }

        const pipeline = [
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [longitude, latitude] },
                    distanceField: 'distanceMeters',
                    maxDistance: radiusKm * 1000,
                    spherical: true,
                    query: geoNearQuery,
                },
            },
            {
                $addFields: {
                    distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] },
                },
            },
            {
                $project: {
                    _id: 1, username: 1, email: 1, role: 1, location: 1, distanceKm: 1,
                },
            },
        ];

        const volunteers = await this.signupModel.aggregate(pipeline as any).exec();
        const enriched: any[] = await this.enrichVolunteers(volunteers as any);
        const withRoad = await this.enrichWithRoadDistance(enriched, latitude, longitude);
        return onlineOnly ? withRoad.filter((v: any) => v.isOnline) : withRoad;
    }

    async getNearbyOnlineVolunteers(longitude: number, latitude: number, radiusKm: number = NEARBY_RADIUS_KM) {
        return this.findNearbyVolunteers(longitude, latitude, radiusKm, undefined, true);
    }

    /** All open requests, newest first. */
    async getAllOpenRequests() {
        return this.helpRequestModel
            .find({ status: 'open' })
            .sort({ createdAt: -1 })
            .populate('userId', 'username email')
            .exec();
    }

    /**
     * Open help requests near a given location.
     * Used by volunteers to see requests in their area.
     */
    async getNearbyOpenRequests(
        longitude: number,
        latitude: number,
        radiusKm: number = NEARBY_RADIUS_KM,
    ) {
        await this.checkSosEscalations();

        const pipeline = [
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [longitude, latitude] },
                    distanceField: 'distanceMeters',
                    maxDistance: radiusKm * 1000,
                    spherical: true,
                    query: { status: 'open' },
                },
            },
            {
                $lookup: {
                    from: 'signups',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userId',
                },
            },
            { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] },
                },
            },
            {
                $project: {
                    _id: 1, title: 1, category: 1, subCategory: 1, description: 1,
                    image: 1, mediaUrls: 1, locationName: 1, location: 1,
                    isSos: 1, status: 1, expiresAt: 1, createdAt: 1, updatedAt: 1, distanceKm: 1,
                    userId: { _id: 1, username: 1, email: 1 },
                },
            },
        ];

        const requests = await this.helpRequestModel.aggregate(pipeline as any).exec();
        const origin = { latitude, longitude };
        const withLocation = requests.filter((r: any) => r.location?.coordinates);
        if (withLocation.length === 0) return requests;

        const destinations = withLocation.map((r: any) => ({
            latitude: r.location.coordinates[1],
            longitude: r.location.coordinates[0],
        }));

        const roadResults = await this.routingService.getDistanceMatrix(origin, destinations);

        let idx = 0;
        return requests.map((req: any) => {
            if (!req.location?.coordinates) return req;
            const road = roadResults[idx++];
            if (road && 'distanceKm' in road && road.distanceKm > 0) {
                return { ...req, roadDistanceKm: road.distanceKm, roadDurationMinutes: road.durationMinutes };
            }
            return { ...req, roadDistanceKm: null, roadDurationMinutes: null };
        });
    }

    /** Get a single help request by ID. */
    async getRequestById(id: string) {
        const request = await this.helpRequestModel
            .findById(id)
            .populate('userId', 'username email')
            .populate('acceptedBy', 'username email role')
            .exec();
        if (!request) throw new NotFoundException('Help request not found');
        return request;
    }

    /** Requests posted by a specific user. */
    async getMyRequests(userId: string) {
        return this.helpRequestModel
            .find({ userId: new Types.ObjectId(userId) })
            .sort({ createdAt: -1 })
            .populate('acceptedBy', 'username email')
            .exec();
    }

    // ──────────────────────────────────────────────
    async getMyActiveRequests(userId: string) {
        await this.checkSosEscalations();

        return this.helpRequestModel
            .find({
                userId: new Types.ObjectId(userId),
                status: { $in: ['open', 'accepted'] },
            })
            .sort({ createdAt: -1 })
            .populate('acceptedBy', 'username email role')
            .exec();
    }


    async getVolunteerCompletedRequestsCount(volunteerId: string) {
        return this.helpRequestModel.countDocuments({
            acceptedBy: new Types.ObjectId(volunteerId),
            status: 'resolved',
        });
    }

    async getRouteToRequest(requestId: string, volunteerId: string) {
        const request = await this.getRequestById(requestId);
        const volunteer = await this.signupModel.findById(volunteerId).exec();
        if (!volunteer || !volunteer.location) {
            throw new NotFoundException('Volunteer location not found');
        }
        const origin = {
            latitude: volunteer.location.coordinates[1],
            longitude: volunteer.location.coordinates[0],
        };
        const destination = {
            latitude: request.location.coordinates[1],
            longitude: request.location.coordinates[0],
        };
        const route = await this.routingService.getRoute(origin, destination);
        return { route, requestId, volunteerId };
    }

    private async enrichWithRoadDistance(volunteers: any[], latitude: number, longitude: number) {
        if (volunteers.length === 0) return volunteers;

        const origin = { latitude, longitude };
        const destinations = volunteers.map((v: any) => ({
            latitude: v.location.coordinates[1],
            longitude: v.location.coordinates[0],
        }));

        const roadResults = await this.routingService.getDistanceMatrix(origin, destinations);

        return volunteers.map((volunteer: any, idx: number) => {
            const road = roadResults[idx];
            if (road && 'distanceKm' in road && road.distanceKm > 0) {
                return {
                    ...volunteer,
                    distanceKm: road.distanceKm,
                    roadDistanceKm: road.distanceKm,
                    roadDurationMinutes: road.durationMinutes,
                };
            }
            return {
                ...volunteer,
                roadDistanceKm: null,
                roadDurationMinutes: null,
            };
        });
    }

    private async enrichVolunteers(volunteers: SignupDocument[]) {
        const ids = volunteers.map((volunteer: any) => volunteer._id.toString());
        const applications = await this.volunteerModel
            .find({ userId: { $in: ids.map((id) => new Types.ObjectId(id)) }, status: 'approved' })
            .sort({ createdAt: -1 })
            .exec();
        const ratings = await this.ratingsService.getVolunteerStatsMap(ids);
        const expertiseByUser = new Map<string, string>();

        for (const application of applications as any[]) {
            const applicationUserId = application.userId.toString();
            if (!expertiseByUser.has(applicationUserId)) {
                expertiseByUser.set(applicationUserId, application.expertise);
            }
        }

        return volunteers.map((volunteer: any) => {
            const id = volunteer._id.toString();
            const rating = ratings.get(id) ?? { ratingAverage: 0, ratingCount: 0 };

            return {
                _id: volunteer._id,
                username: volunteer.username,
                email: volunteer.email,
                role: volunteer.role,
                location: volunteer.location,
                distanceKm: volunteer.distanceKm ?? null,
                expertise: expertiseByUser.get(id) ?? '',
                ratingAverage: rating.ratingAverage,
                ratingCount: rating.ratingCount,
                isOnline: this.chatGateway.isUserOnline(id),
            };
        });
    }

    // STATUS TRANSITIONS
    // ──────────────────────────────────────────────

    /**
     * Volunteer accepts an open help request.
     * Only verified volunteers (role === 'volunteer') may accept.
     */
    async acceptRequest(requestId: string, volunteerId: string) {
        const request = await this.getRequestById(requestId);

        if (request.status !== 'open') {
            throw new BadRequestException('This request is no longer open');
        }

        // Prevent the requester from accepting their own request
        if (request.userId._id.toString() === volunteerId) {
            throw new BadRequestException('You cannot accept your own request');
        }

        const saved = await this.helpRequestModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(requestId), status: 'open' },
                {
                    $set: {
                        status: 'accepted',
                        acceptedBy: new Types.ObjectId(volunteerId),
                    },
                },
                { new: true },
            )
            .populate('userId', 'username email')
            .populate('acceptedBy', 'username email role')
            .exec();

        if (!saved) {
            throw new BadRequestException('This request is no longer open');
        }

        this.chatGateway.notifyUsers([request.userId._id.toString()], 'help_request_accepted', {
            requestId: saved._id,
            volunteerId,
        });

        return saved;
    }

    /**
     * Mark a help request as resolved.
     * Only the original poster or the volunteer who accepted can resolve it.
     */
    async resolveRequest(requestId: string, userId: string) {
        const request = await this.getRequestById(requestId);

        if (request.status === 'resolved') {
            throw new BadRequestException('This request is already resolved');
        }

        const isOwner = request.userId._id.toString() === userId;
        const isAcceptor = request.acceptedBy && request.acceptedBy._id.toString() === userId;

        if (!isOwner && !isAcceptor) {
            throw new BadRequestException('Only the requester or accepting volunteer can resolve this request');
        }

        const saved = await this.helpRequestModel
            .findOneAndUpdate(
                { _id: new Types.ObjectId(requestId), status: { $ne: 'resolved' } },
                { $set: { status: 'resolved' } },
                { new: true },
            )
            .populate('userId', 'username email')
            .populate('acceptedBy', 'username email role')
            .exec();

        if (!saved) {
            throw new BadRequestException('This request is already resolved');
        }

        if (isAcceptor) {
            this.chatGateway.notifyUsers([request.userId._id.toString()], 'help_request_resolved', {
                requestId: saved._id,
                volunteerId: userId,
                promptForRating: true,
            });
        } else if (request.acceptedBy) {
            this.chatGateway.notifyUsers([request.acceptedBy._id.toString()], 'help_request_resolved', {
                requestId: saved._id,
                resolvedBy: userId,
            });
        }

        return saved;
    }

    async rateRequest(requestId: string, requesterId: string, dto: RateHelpRequestDto) {
        const request = await this.getRequestById(requestId);

        if (request.userId._id.toString() !== requesterId) {
            throw new BadRequestException('Only the requester can rate this help request');
        }

        if (request.status !== 'resolved') {
            throw new BadRequestException('Only resolved help requests can be rated');
        }

        if (!request.acceptedBy) {
            throw new BadRequestException('No volunteer accepted this request');
        }

        const volunteerId = request.acceptedBy._id.toString();
        const rating = await this.ratingsService.createHelpRequestRating(requestId, requesterId, volunteerId, dto);
        const volunteerStats = await this.ratingsService.getVolunteerStats(volunteerId);

        return { rating, volunteerStats };
    }
}
