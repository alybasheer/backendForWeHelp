import { BadRequestException, Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
    constructor(private readonly alertsService: AlertsService) {}

    @Post()
    async create(@Req() req: any, @Body() dto: CreateAlertDto) {
        const { alert, notified } = await this.alertsService.createAlert(req.user.sub, dto);

        return {
            success: true,
            message: `Alert sent to ${notified} online user(s)`,
            data: alert,
        };
    }

    @Get()
    async findActive(
        @Query('lat') lat?: string,
        @Query('lng') lng?: string,
        @Query('radius') radius?: string,
    ) {
        let latitude: number | undefined;
        let longitude: number | undefined;
        const radiusKm = radius ? parseFloat(radius) : undefined;

        if (lat || lng) {
            latitude = parseFloat(lat ?? '');
            longitude = parseFloat(lng ?? '');
            if (isNaN(latitude) || isNaN(longitude)) {
                throw new BadRequestException('lat and lng must be valid numbers');
            }
        }

        const alerts = await this.alertsService.getActiveAlerts(latitude, longitude, radiusKm);

        return {
            success: true,
            message: `Found ${alerts.length} active alert(s)`,
            data: alerts,
        };
    }
}
