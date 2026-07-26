import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatGateway } from '../chat/chat.gateway';
import { AlertDocument } from './alert.schema';
import { CreateAlertDto } from './dto/create-alert.dto';

const DEFAULT_ALERT_TTL_HOURS = 6;
const DEFAULT_ALERT_RADIUS_KM = 25;

@Injectable()
export class AlertsService {
    constructor(
        @InjectModel('Alert') private alertModel: Model<AlertDocument>,
        private readonly chatGateway: ChatGateway,
    ) {}

    async createAlert(userId: string, dto: CreateAlertDto) {
        const expiresInHours = dto.expiresInHours ?? DEFAULT_ALERT_TTL_HOURS;
        const alert = await new this.alertModel({
            createdBy: new Types.ObjectId(userId),
            title: dto.title,
            description: dto.description,
            locationName: dto.locationName,
            location: {
                type: 'Point',
                coordinates: [dto.longitude, dto.latitude],
            },
            expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
        }).save();

        const notified = this.chatGateway.broadcast('new_alert', {
            _id: alert._id,
            title: alert.title,
            description: alert.description,
            locationName: alert.locationName,
            createdBy: alert.createdBy,
            expiresAt: alert.expiresAt,
        });

        return { alert, notified };
    }

    async getActiveAlerts(latitude?: number, longitude?: number, radiusKm = DEFAULT_ALERT_RADIUS_KM) {
        if (latitude !== undefined && longitude !== undefined) {
            const pipeline = [
                {
                    $geoNear: {
                        near: { type: 'Point', coordinates: [longitude, latitude] },
                        distanceField: 'distanceMeters',
                        maxDistance: radiusKm * 1000,
                        spherical: true,
                        query: { expiresAt: { $gt: new Date() } },
                    },
                },
                {
                    $lookup: {
                        from: 'signups',
                        localField: 'createdBy',
                        foreignField: '_id',
                        as: 'createdBy',
                    },
                },
                { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] },
                    },
                },
                {
                    $project: {
                        _id: 1, title: 1, description: 1, locationName: 1,
                        location: 1, expiresAt: 1, createdAt: 1, updatedAt: 1, distanceKm: 1,
                        createdBy: { _id: 1, username: 1, email: 1, role: 1 },
                    },
                },
            ];

            return this.alertModel.aggregate(pipeline as any).exec();
        }

        return this.alertModel
            .find({ expiresAt: { $gt: new Date() } })
            .sort({ createdAt: -1 })
            .populate('createdBy', 'username email role')
            .exec();
    }
}
