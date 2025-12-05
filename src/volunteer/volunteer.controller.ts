import { BadRequestException, Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApplyVolunteerDto } from './dto/apply-volunteer.dto';
import { VolunteerService } from './volunteer.service';

@Controller('volunteer')
export class VolunteerController {
    constructor(
        private readonly volunteerService: VolunteerService,
        private readonly jwtService: JwtService,
    ) { }

    private verifyTokenAndGetPayload(authHeader: string) {
        if (!authHeader) throw new BadRequestException('Authorization header required');
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const payload: any = this.jwtService.verify(token, { secret: process.env.JWT_SECRET ?? 'dev_secret_key' });
        return payload;
    }

    @Post('apply')
    async apply(@Headers('authorization') auth: string, @Body() body: ApplyVolunteerDto) {
        const payload = this.verifyTokenAndGetPayload(auth);
        const userId = payload.sub;
        // require necessary fields
        const { name, city, location, expertise, reason, image, cnic } = body;
        if (!name || !city || !location || !expertise || !reason || !cnic) {
            throw new BadRequestException('Missing required application fields');
        }
        const application = await this.volunteerService.createApplication(userId, { name, city, location, expertise, reason, image, cnic });
        return {
            success: true,
            message: 'Application submitted successfully',
            data: application,
        };
    }

    @Get('my-application')
    async myApplications(@Headers('authorization') auth: string) {
        const payload = this.verifyTokenAndGetPayload(auth);
        const userId = payload.sub;
        const applications = await this.volunteerService.findByUser(userId);
        return {
            success: true,
            data: applications,
        };
    }

    @Get('status')
    async getVolunteerStatus(@Headers('authorization') auth: string) {
        const payload = this.verifyTokenAndGetPayload(auth);
        const userId = payload.sub;

        // Find the volunteer verification record for this user
        const verification = await this.volunteerService.findByUserId(userId);

        // If no record exists, return pending status
        if (!verification) {
            return {
                status: 'success',
                data: {
                    status: 'pending',
                    message: 'No application found. User can submit a new application.',
                },
            };
        }

        // Return the full verification record with status
        return {
            status: 'success',
            data: verification,
        };
    }
}
