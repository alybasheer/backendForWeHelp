import { BadRequestException, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly jwtService: JwtService,
    ) { }

    private verifyTokenAndGetPayload(authHeader: string) {
        if (!authHeader) throw new BadRequestException('Authorization header required');
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const payload: any = this.jwtService.verify(token, { secret: process.env.JWT_SECRET ?? 'dev_secret_key' });
        return payload;
    }

    private ensureAdmin(payload: any) {
        if (payload.role !== 'admin') throw new BadRequestException('Admin credentials required');
    }

    /**
     * GET /admin/volunteer-applications
     * Retrieve all volunteer applications (optionally filtered by status)
     * Query params: status (optional) - "pending", "approved", "rejected"
     */
    @Get('volunteer-applications')
    async getApplications(
        @Headers('authorization') auth: string,
        @Query('status') status?: string,
    ) {
        const payload = this.verifyTokenAndGetPayload(auth);
        this.ensureAdmin(payload);

        let applications;
        if (status) {
            applications = await this.adminService.getAllApplications(status);
        } else {
            applications = await this.adminService.getAllPendingApplications();
        }

        return {
            success: true,
            message: `Found ${applications.length} applications`,
            data: applications,
        };
    }

    /**
     * GET /admin/volunteer-applications/:id
     * Retrieve a specific volunteer application
     */
    @Get('volunteer-applications/:id')
    async getApplicationById(
        @Headers('authorization') auth: string,
        @Param('id') id: string,
    ) {
        const payload = this.verifyTokenAndGetPayload(auth);
        this.ensureAdmin(payload);

        const application = await this.adminService.getApplicationById(id);
        return {
            success: true,
            data: application,
        };
    }

    /**
     * POST /admin/volunteer-applications/:id/approve
     * Approve a volunteer application and update user role to 'volunteer'
     */
    @Post('volunteer-applications/:id/approve')
    async approveApplication(
        @Headers('authorization') auth: string,
        @Param('id') id: string,
    ) {
        const payload = this.verifyTokenAndGetPayload(auth);
        this.ensureAdmin(payload);

        const application = await this.adminService.approveApplication(id);
        return {
            success: true,
            message: 'Application approved and user role updated to volunteer',
            data: application,
        };
    }

    /**
     * POST /admin/volunteer-applications/:id/reject
     * Reject a volunteer application and reset user role to 'user'
     */
    @Post('volunteer-applications/:id/reject')
    async rejectApplication(
        @Headers('authorization') auth: string,
        @Param('id') id: string,
    ) {
        const payload = this.verifyTokenAndGetPayload(auth);
        this.ensureAdmin(payload);

        const application = await this.adminService.rejectApplication(id);
        return {
            success: true,
            message: 'Application rejected and user role reset to user',
            data: application,
        };
    }
}
