import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatGateway } from '../chat/chat.gateway';
import { AlertDocument } from './dto/alert.schema';
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
        const query: any = {
            expiresAt: { $gt: new Date() },
        };

        if (latitude !== undefined && longitude !== undefined) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: radiusKm * 1000,
                },
            };
        }

        const request = this.alertModel.find(query).populate('createdBy', 'username email role');

        if (!query.location) {
            request.sort({ createdAt: -1 });
        }

        return request.exec();
    }
}
