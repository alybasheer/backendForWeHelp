import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SignupDocument } from '../authentication/signup.schema';
import { ChatGateway } from '../chat/chat.gateway';

const DEFAULT_MAP_RADIUS_KM = 25;

@Injectable()
export class MapService {
    constructor(
        @InjectModel('Signup') private signupModel: Model<SignupDocument>,
        private readonly chatGateway: ChatGateway,
    ) {}

    async getUsers(filters: { latitude?: number; longitude?: number; radiusKm?: number; role?: string }) {
        const query: any = {
            'location.type': 'Point',
        };

        if (filters.role) {
            query.role = filters.role === 'requestee' ? 'user' : filters.role;
        }

        if (filters.latitude !== undefined && filters.longitude !== undefined) {
            query.location = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [filters.longitude, filters.latitude],
                    },
                    $maxDistance: (filters.radiusKm ?? DEFAULT_MAP_RADIUS_KM) * 1000,
                },
            };
        }

        const users = await this.signupModel.find(query).select('_id username email role location').exec();

        return users.map((user: any) => ({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            location: user.location,
            isOnline: this.chatGateway.isUserOnline(user._id.toString()),
            iconType: user.role === 'volunteer' ? 'volunteer' : 'requestee',
        }));
    }
}
