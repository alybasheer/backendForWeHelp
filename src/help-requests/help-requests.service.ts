import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SignupDocument } from '../authentication/signup.schema';
import { ChatGateway } from '../chat/chat.gateway';
import { RateHelpRequestDto } from '../ratings/dto/rate-help-request.dto';
import { RatingsService } from '../ratings/ratings.service';
import { VolunteerDocument } from '../volunteer/volunteer.schema';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateSosRequestDto } from './dto/create-sos-request.dto';
import { HelpRequestDocument } from './help-request.schema';

/** Default radius in kilometres for nearby-volunteer queries. */
const NEARBY_RADIUS_KM = parseInt(process.env.NEARBY_RADIUS_KM ?? '10', 10);

/** Help requests auto-expire after this many hours. */
const TTL_HOURS = 24;

@Injectable()
export class HelpRequestsService {
    constructor(
        @InjectModel('HelpRequest') private helpRequestModel: Model<HelpRequestDocument>,
        @InjectModel('Signup') private signupModel: Model<SignupDocument>,
        @InjectModel('Volunteer') private volunteerModel: Model<VolunteerDocument>,
        private readonly chatGateway: ChatGateway,
        private readonly ratingsService: RatingsService,
    ) {}

    // ──────────────────────────────────────────────
    // CREATE
    // ──────────────────────────────────────────────

    /**
     * Create a new help request and return it along with a list of
     * nearby verified volunteers who should be notified.
     */
    async createRequest(userId: string, dto: CreateHelpRequestDto) {
        const location = {
            type: 'Point' as const,
            coordinates: [dto.longitude, dto.latitude], // GeoJSON: [lng, lat]
        };

        const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

        const created = new this.helpRequestModel({
            userId: new Types.ObjectId(userId),
            title: dto.title,
            category: dto.category,
            subCategory: dto.subCategory,
            description: dto.description,
            image: dto.image,
            locationName: dto.locationName,
            isSos: (dto as any).isSos ?? false,
            location,
            status: 'open',
            expiresAt,
        });

        const saved = await created.save();

        // Find nearby verified volunteers (async, non-blocking for the response)
        const nearbyVolunteers = await this.findNearbyVolunteers(
            dto.longitude,
            dto.latitude,
            NEARBY_RADIUS_KM,
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
                location: saved.location,
                locationName: saved.locationName,
                isSos: saved.isSos,
            },
        );

        return { request: saved, nearbyVolunteers, nearbyOnlineVolunteers, notified };
    }

    async createSosRequest(userId: string, dto: CreateSosRequestDto) {
        const request = await this.createRequest(userId, {
            title: dto.title,
            category: 'SOS',
            subCategory: dto.title,
            description: dto.title,
            locationName: dto.locationName,
            latitude: dto.latitude,
            longitude: dto.longitude,
            isSos: true,
        } as CreateHelpRequestDto & { isSos: boolean });

        return request;
    }

    // ──────────────────────────────────────────────
    // QUERIES
    // ──────────────────────────────────────────────

    /**
     * Find verified volunteers within `radiusKm` of a given point.
     * Uses MongoDB 2dsphere + $near geospatial query.
     */
    async findNearbyVolunteers(
        longitude: number,
        latitude: number,
        radiusKm: number = NEARBY_RADIUS_KM,
        excludeUserId?: string,
        onlineOnly = false,
    ) {
        const query: any = {
            role: 'volunteer',
            'location.type': 'Point',
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: radiusKm * 1000, // metres
                },
            },
        };

        // Exclude the help seeker from the volunteer list
        if (excludeUserId && Types.ObjectId.isValid(excludeUserId)) {
            query._id = { $ne: new Types.ObjectId(excludeUserId) };
        }

        const volunteers = await this.signupModel
            .find(query)
            .select('_id username email role location')
            .exec();

        const enriched = await this.enrichVolunteers(volunteers);
        return onlineOnly ? enriched.filter((volunteer: any) => volunteer.isOnline) : enriched;
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
        return this.helpRequestModel
            .find({
                status: 'open',
                location: {
                    $near: {
                        $geometry: {
                            type: 'Point',
                            coordinates: [longitude, latitude],
                        },
                        $maxDistance: radiusKm * 1000,
                    },
                },
            })
            .populate('userId', 'username email')
            .exec();
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
        return this.helpRequestModel
            .find({
                userId: new Types.ObjectId(userId),
                status: { $in: ['open', 'accepted'] },
            })
            .sort({ createdAt: -1 })
            .populate('acceptedBy', 'username email role')
            .exec();
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
