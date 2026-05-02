import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CommunityDocument, CommunityMessageDocument } from './community.schema';
import { CreateCommunityDto } from './dto/create-community.dto';
import { SendCommunityMessageDto } from './dto/send-community-message.dto';

const DEFAULT_COMMUNITY_RADIUS_KM = 25;

@Injectable()
export class CommunitiesService {
    constructor(
        @InjectModel('Community') private communityModel: Model<CommunityDocument>,
        @InjectModel('CommunityMessage') private communityMessageModel: Model<CommunityMessageDocument>,
    ) {}

    async create(userId: string, dto: CreateCommunityDto) {
        return new this.communityModel({
            createdBy: new Types.ObjectId(userId),
            title: dto.title,
            details: dto.details,
            category: dto.category,
            timeNeeded: dto.timeNeeded,
            locationName: dto.locationName,
            location: {
                type: 'Point',
                coordinates: [dto.longitude, dto.latitude],
            },
            peopleRequired: dto.peopleRequired,
            members: [new Types.ObjectId(userId)],
            status: 'open',
        }).save();
    }

    async findAll(filters: {
        category?: string;
        status?: string;
        latitude?: number;
        longitude?: number;
        radiusKm?: number;
    }) {
        const query: any = {};

        if (filters.category) query.category = filters.category;
        query.status = filters.status ?? { $ne: 'cancelled' };

        if (filters.latitude !== undefined && filters.longitude !== undefined) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [filters.longitude, filters.latitude],
                    },
                    $maxDistance: (filters.radiusKm ?? DEFAULT_COMMUNITY_RADIUS_KM) * 1000,
                },
            };
        }

        const request = this.communityModel
            .find(query)
            .populate('createdBy', 'username email role')
            .populate('members', 'username email role');

        if (!query.location) {
            request.sort({ createdAt: -1 });
        }

        return request.exec();
    }

    async findById(id: string) {
        const community = await this.communityModel
            .findById(id)
            .populate('createdBy', 'username email role')
            .populate('members', 'username email role')
            .exec();

        if (!community) throw new NotFoundException('Community not found');
        if (community.status === 'cancelled') throw new NotFoundException('Community not found');
        return community;
    }

    async join(id: string, userId: string) {
        const community = await this.communityModel.findById(id).exec();
        if (!community) throw new NotFoundException('Community not found');
        if (community.status !== 'open') throw new BadRequestException('This community is not open for joining');

        const userObjectId = new Types.ObjectId(userId);
        if (!community.members.some((memberId) => memberId.toString() === userId)) {
            community.members.push(userObjectId);
        }

        return community.save();
    }

    async start(id: string, userId: string, role: string) {
        const community = await this.communityModel.findById(id).exec();
        if (!community) throw new NotFoundException('Community not found');
        this.ensureOwnerOrAdmin(community.createdBy.toString(), userId, role);

        community.status = 'started';
        return community.save();
    }

    async remove(id: string, userId: string, role: string) {
        const community = await this.communityModel.findById(id).exec();
        if (!community) throw new NotFoundException('Community not found');
        this.ensureOwnerOrAdmin(community.createdBy.toString(), userId, role);

        community.status = 'cancelled';
        await community.save();
        await this.communityMessageModel.deleteMany({ communityId: community._id });
        return { deleted: true };
    }

    async getMessages(id: string, userId: string, role: string) {
        await this.ensureParticipant(id, userId, role);

        return this.communityMessageModel
            .find({ communityId: new Types.ObjectId(id) })
            .sort({ createdAt: 1 })
            .populate('senderId', 'username email role')
            .exec();
    }

    async sendMessage(id: string, userId: string, role: string, dto: SendCommunityMessageDto) {
        await this.ensureParticipant(id, userId, role);

        const message = await new this.communityMessageModel({
            communityId: new Types.ObjectId(id),
            senderId: new Types.ObjectId(userId),
            content: dto.content,
        }).save();

        const communityStillActive = await this.communityModel
            .exists({ _id: new Types.ObjectId(id), status: { $ne: 'cancelled' } })
            .exec();

        if (!communityStillActive) {
            await message.deleteOne();
            throw new NotFoundException('Community not found');
        }

        return message;
    }

    private ensureOwnerOrAdmin(ownerId: string, userId: string, role: string) {
        if (role !== 'admin' && ownerId !== userId) {
            throw new BadRequestException('Only the community creator or admin can perform this action');
        }
    }

    private async ensureParticipant(id: string, userId: string, role: string) {
        const community = await this.communityModel.findById(id).exec();
        if (!community) throw new NotFoundException('Community not found');
        if (community.status === 'cancelled') throw new NotFoundException('Community not found');

        const isCreator = community.createdBy.toString() === userId;
        const isMember = community.members.some((memberId) => memberId.toString() === userId);

        if (role !== 'admin' && !isCreator && !isMember) {
            throw new BadRequestException('Join this community before using its chat');
        }

        return community;
    }
}
