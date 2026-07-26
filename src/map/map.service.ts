import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SignupDocument } from '../authentication/signup.schema';
import { ChatGateway } from '../chat/chat.gateway';
import { RoutingService } from '../common/services/routing.service';

const DEFAULT_MAP_RADIUS_KM = 25;

@Injectable()
export class MapService {
    constructor(
        @InjectModel('Signup') private signupModel: Model<SignupDocument>,
        private readonly chatGateway: ChatGateway,
        private readonly routingService: RoutingService,
    ) {}

    async getUsers(filters: { latitude?: number; longitude?: number; radiusKm?: number; role?: string }) {
        const role = filters.role === 'requestee' ? 'user' : filters.role;

        if (filters.latitude !== undefined && filters.longitude !== undefined) {
            const geoNearQuery: any = { 'location.type': 'Point' };
            if (role) geoNearQuery.role = role;

            const pipeline = [
                {
                    $geoNear: {
                        near: { type: 'Point', coordinates: [filters.longitude, filters.latitude] },
                        distanceField: 'distanceMeters',
                        maxDistance: (filters.radiusKm ?? DEFAULT_MAP_RADIUS_KM) * 1000,
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

            const users = await this.signupModel.aggregate(pipeline as any).exec();
            const mapped = users.map((user: any) => ({
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                location: user.location,
                distanceKm: user.distanceKm ?? null,
                isOnline: this.chatGateway.isUserOnline(user._id.toString()),
                iconType: user.role === 'volunteer' ? 'volunteer' : 'requestee',
            }));

            const withRoad = await this.enrichMapUsersWithRoad(
                mapped,
                filters.latitude!,
                filters.longitude!,
            );
            return withRoad;
        }

        const query: any = { 'location.type': 'Point' };
        if (role) query.role = role;

        const users = await this.signupModel.find(query).select('_id username email role location').exec();
        return users.map((user: any) => ({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            location: user.location,
            distanceKm: null,
            isOnline: this.chatGateway.isUserOnline(user._id.toString()),
            iconType: user.role === 'volunteer' ? 'volunteer' : 'requestee',
        }));
    }

    private async enrichMapUsersWithRoad(users: any[], latitude: number, longitude: number) {
        const withLocation = users.filter((u: any) => u.location?.coordinates);
        if (withLocation.length === 0) return users;

        const origin = { latitude, longitude };
        const destinations = withLocation.map((u: any) => ({
            latitude: u.location.coordinates[1],
            longitude: u.location.coordinates[0],
        }));

        const roadResults = await this.routingService.getDistanceMatrix(origin, destinations);

        let roadIdx = 0;
        return users.map((user: any) => {
            if (!user.location?.coordinates) return user;
            const road = roadResults[roadIdx++];
            if (road && 'distanceKm' in road && road.distanceKm > 0) {
                return { ...user, roadDistanceKm: road.distanceKm, roadDurationMinutes: road.durationMinutes };
            }
            return { ...user, roadDistanceKm: null, roadDurationMinutes: null };
        });
    }
}
