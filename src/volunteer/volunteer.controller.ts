import { BadRequestException, Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticationService } from '../authentication/authentication.service';
import { ApplyVolunteerDto } from './dto/apply-volunteer.dto';
import { VolunteerService } from './volunteer.service';

@ApiTags('volunteer')
@ApiBearerAuth('access-token')
@Controller('volunteer')
export class VolunteerController {
    constructor(
        private readonly volunteerService: VolunteerService,
        private readonly jwtService: JwtService,
        private readonly authService: AuthenticationService,
    ) { }

    private verifyTokenAndGetPayload(authHeader: string) {
        if (!authHeader) throw new BadRequestException('Authorization header required');
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const payload: any = this.jwtService.verify(token, { secret: process.env.JWT_SECRET ?? 'dev_secret_key' });
        return payload;
    }

    @Post('apply')
    @ApiOperation({ summary: 'Apply as a volunteer' })
    async apply(@Headers('authorization') auth: string, @Body() body: ApplyVolunteerDto) {
        const payload = this.verifyTokenAndGetPayload(auth);
        const userId = payload.sub;
        // require necessary fields
        const { name, city, location, expertise, reason, image, cnic } = body;
        if (!name || !city || !location || !expertise || !reason || !cnic) {
            throw new BadRequestException('Missing required application fields');
        }
        return this.volunteerService.createApplication(userId, { name, city, location, expertise, reason, image, cnic });
    }

    @Get('my-applications')
    async myApplications(@Headers('authorization') auth: string) {
        const payload = this.verifyTokenAndGetPayload(auth);
        const userId = payload.sub;
        return this.volunteerService.findByUser(userId);
    }

    // Admin endpoints
    @Get('admin/applications')
    async listPending(@Headers('authorization') auth: string) {
        const payload = this.verifyTokenAndGetPayload(auth);
        if (payload.role !== 'admin') throw new BadRequestException('Admin credentials required');
        return this.volunteerService.findAllPending();
    }

    @Post('admin/:id/approve')
    async approve(@Headers('authorization') auth: string, @Param('id') id: string) {
        const payload = this.verifyTokenAndGetPayload(auth);
        if (payload.role !== 'admin') throw new BadRequestException('Admin credentials required');
        return this.volunteerService.approve(id);
    }

    @Post('admin/:id/reject')
    async reject(@Headers('authorization') auth: string, @Param('id') id: string) {
        const payload = this.verifyTokenAndGetPayload(auth);
        if (payload.role !== 'admin') throw new BadRequestException('Admin credentials required');
        return this.volunteerService.reject(id);
    }
}
