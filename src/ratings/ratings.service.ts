import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RateHelpRequestDto } from './dto/rate-help-request.dto';
import { RatingDocument } from './rating.schema';

@Injectable()
export class RatingsService {
    constructor(@InjectModel('Rating') private ratingModel: Model<RatingDocument>) {}

    async createHelpRequestRating(
        requestId: string,
        requesterId: string,
        volunteerId: string,
        dto: RateHelpRequestDto,
    ) {
        const existing = await this.ratingModel.findOne({
            requestId: new Types.ObjectId(requestId),
            requesterId: new Types.ObjectId(requesterId),
        });

        if (existing) {
            throw new BadRequestException('This help request has already been rated');
        }

        return new this.ratingModel({
            requestId: new Types.ObjectId(requestId),
            requesterId: new Types.ObjectId(requesterId),
            volunteerId: new Types.ObjectId(volunteerId),
            score: dto.score,
            comment: dto.comment,
        }).save();
    }

    async getVolunteerStats(volunteerId: string) {
        const [stats] = await this.ratingModel.aggregate([
            { $match: { volunteerId: new Types.ObjectId(volunteerId) } },
            {
                $group: {
                    _id: '$volunteerId',
                    ratingAverage: { $avg: '$score' },
                    ratingCount: { $sum: 1 },
                },
            },
        ]);

        return {
            ratingAverage: stats ? Number(stats.ratingAverage.toFixed(1)) : 0,
            ratingCount: stats?.ratingCount ?? 0,
        };
    }

    async getVolunteerRatings(volunteerId: string) {
        return this.ratingModel
            .find({ volunteerId: new Types.ObjectId(volunteerId) })
            .populate('requesterId', 'username email')
            .populate('requestId')
            .sort({ createdAt: -1 })
            .exec();
    }

    async getVolunteerStatsMap(volunteerIds: string[]) {
        const objectIds = volunteerIds.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));

        if (objectIds.length === 0) {
            return new Map<string, { ratingAverage: number; ratingCount: number }>();
        }

        const stats = await this.ratingModel.aggregate([
            { $match: { volunteerId: { $in: objectIds } } },
            {
                $group: {
                    _id: '$volunteerId',
                    ratingAverage: { $avg: '$score' },
                    ratingCount: { $sum: 1 },
                },
            },
        ]);

        return new Map(
            stats.map((item) => [
                item._id.toString(),
                {
                    ratingAverage: Number(item.ratingAverage.toFixed(1)),
                    ratingCount: item.ratingCount,
                },
            ]),
        );
    }
}
