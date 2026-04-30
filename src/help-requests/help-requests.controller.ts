import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RateHelpRequestDto } from '../ratings/dto/rate-help-request.dto';
import { CreateHelpRequestDto } from './dto/create-help-request.dto';
import { CreateSosRequestDto } from './dto/create-sos-request.dto';
import { HelpRequestsService } from './help-requests.service';

@Controller('help-requests')
@UseGuards(JwtAuthGuard)
export class HelpRequestsController {
    constructor(private readonly helpRequestsService: HelpRequestsService) { }

    // ──────────────────────────────────────────────
    // POST /help-requests
    // Create a new help request
    // ──────────────────────────────────────────────

    @Post()
    async create(@Req() req: any, @Body() dto: CreateHelpRequestDto) {
        const userId = req.user.sub;

        const { request, nearbyVolunteers, nearbyOnlineVolunteers, notified } =
            await this.helpRequestsService.createRequest(userId, dto);

        return {
            success: true,
            message: `Help request created. ${nearbyOnlineVolunteers.length} active nearby volunteer(s) found.`,
            data: {
                request,
                nearbyVolunteerCount: nearbyVolunteers.length,
                nearbyOnlineVolunteerCount: nearbyOnlineVolunteers.length,
                nearbyVolunteers,
                nearbyOnlineVolunteers,
                notified,
            },
        };
    }

    @Post('sos')
    async createSos(@Req() req: any, @Body() dto: CreateSosRequestDto) {
        const { request, nearbyOnlineVolunteers, notified } =
            await this.helpRequestsService.createSosRequest(req.user.sub, dto);

        return {
            success: true,
            message: `SOS sent to ${notified} active nearby volunteer(s)`,
            data: {
                request,
                nearbyOnlineVolunteerCount: nearbyOnlineVolunteers.length,
                nearbyOnlineVolunteers,
                notified,
            },
        };
    }

    // ──────────────────────────────────────────────
    // GET /help-requests
    // List open requests — optionally filter by proximity
    // Query: ?lat=31.5&lng=74.3&radius=10
    // ──────────────────────────────────────────────

    @Get()
    async findAll(
        @Query('lat') lat?: string,
        @Query('lng') lng?: string,
        @Query('radius') radius?: string,
    ) {
        // If lat/lng provided, return nearby open requests
        if (lat && lng) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            const radiusKm = radius ? parseFloat(radius) : 10;

            if (isNaN(latitude) || isNaN(longitude)) {
                throw new BadRequestException('lat and lng must be valid numbers');
            }

            const requests = await this.helpRequestsService.getNearbyOpenRequests(
                longitude,
                latitude,
                radiusKm,
            );

            return {
                success: true,
                message: `Found ${requests.length} open request(s) within ${radiusKm}km`,
                data: requests,
            };
        }

        // Otherwise return all open requests
        const requests = await this.helpRequestsService.getAllOpenRequests();
        return {
            success: true,
            message: `Found ${requests.length} open request(s)`,
            data: requests,
        };
    }

    // ──────────────────────────────────────────────
    // GET /help-requests/my
    // My posted requests (any status)
    // ──────────────────────────────────────────────

    @Get('nearby-volunteers')
    async nearbyVolunteers(
        @Query('lat') lat: string,
        @Query('lng') lng: string,
        @Query('radius') radius?: string,
        @Query('onlineOnly') onlineOnly?: string,
    ) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        const radiusKm = radius ? parseFloat(radius) : 10;

        if (isNaN(latitude) || isNaN(longitude)) {
            throw new BadRequestException('lat and lng must be valid numbers');
        }

        const volunteers = await this.helpRequestsService.findNearbyVolunteers(
            longitude,
            latitude,
            radiusKm,
            undefined,
            onlineOnly !== 'false',
        );

        return {
            success: true,
            message: `Found ${volunteers.length} nearby volunteer(s)`,
            data: volunteers,
        };
    }

    @Get('my/active')
    async myActiveRequests(@Req() req: any) {
        const requests = await this.helpRequestsService.getMyActiveRequests(req.user.sub);
        return {
            success: true,
            data: requests,
        };
    }

    @Get('my')
    async myRequests(@Req() req: any) {
        const userId = req.user.sub;
        const requests = await this.helpRequestsService.getMyRequests(userId);
        return {
            success: true,
            data: requests,
        };
    }

    // ──────────────────────────────────────────────
    // GET /help-requests/:id
    // Single request details
    // ──────────────────────────────────────────────

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const request = await this.helpRequestsService.getRequestById(id);
        return {
            success: true,
            data: request,
        };
    }

    // ──────────────────────────────────────────────
    // PATCH /help-requests/:id/accept
    // Volunteer accepts an open request
    // ──────────────────────────────────────────────

    @Patch(':id/accept')
    async accept(@Req() req: any, @Param('id') id: string) {
        const volunteerId = req.user.sub;
        const role = req.user.role;

        if (role !== 'volunteer' && role !== 'admin') {
            throw new BadRequestException('Only verified volunteers can accept help requests');
        }

        const request = await this.helpRequestsService.acceptRequest(id, volunteerId);
        return {
            success: true,
            message: 'Help request accepted',
            data: request,
        };
    }

    // ──────────────────────────────────────────────
    // PATCH /help-requests/:id/resolve
    // Mark request as resolved (owner or accepting volunteer)
    // ──────────────────────────────────────────────

    @Patch(':id/resolve')
    async resolve(@Req() req: any, @Param('id') id: string) {
        const userId = req.user.sub;
        const request = await this.helpRequestsService.resolveRequest(id, userId);
        return {
            success: true,
            message: 'Help request resolved',
            data: request,
        };
    }

    @Patch(':id/release')
    async release(@Req() req: any, @Param('id') id: string) {
        const request = await this.helpRequestsService.resolveRequest(id, req.user.sub);
        return {
            success: true,
            message: 'Help request released',
            data: request,
        };
    }

    @Post(':id/rating')
    async rate(@Req() req: any, @Param('id') id: string, @Body() dto: RateHelpRequestDto) {
        const result = await this.helpRequestsService.rateRequest(id, req.user.sub, dto);
        return {
            success: true,
            message: 'Volunteer rated',
            data: result,
        };
    }
}
