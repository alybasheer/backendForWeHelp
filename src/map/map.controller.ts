import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MapService } from './map.service';

@Controller('map')
@UseGuards(JwtAuthGuard)
export class MapController {
    constructor(private readonly mapService: MapService) {}

    @Get('users')
    async getUsers(
        @Query('lat') lat?: string,
        @Query('lng') lng?: string,
        @Query('radius') radius?: string,
        @Query('role') role?: string,
    ) {
        const latitude = lat ? parseFloat(lat) : undefined;
        const longitude = lng ? parseFloat(lng) : undefined;
        const radiusKm = radius ? parseFloat(radius) : undefined;

        if ((lat || lng) && (latitude === undefined || longitude === undefined || isNaN(latitude) || isNaN(longitude))) {
            throw new BadRequestException('lat and lng must be valid numbers');
        }

        const users = await this.mapService.getUsers({ latitude, longitude, radiusKm, role });

        return {
            success: true,
            data: users,
        };
    }
}
