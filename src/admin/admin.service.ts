import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthenticationService } from '../authentication/authentication.service';
import { VolunteerDocument } from '../volunteer/volunteer.schema';

@Injectable()
export class AdminService {
    constructor(
        @InjectModel('Volunteer') private volunteerModel: Model<VolunteerDocument>,
        private readonly authService: AuthenticationService,
    ) { }

    async getAllPendingApplications() {
        return this.volunteerModel.find({ status: 'pending' }).populate('userId').exec();
    }

    async getAllApplications(status?: string) {
        if (status) {
            return this.volunteerModel.find({ status }).populate('userId').exec();
        }
        return this.volunteerModel.find().populate('userId').exec();
    }

    async getApplicationById(id: string) {
        const app = await this.volunteerModel.findById(id).populate('userId').exec();
        if (!app) throw new NotFoundException('Application not found');
        return app;
    }

    async approveApplication(id: string) {
        const app = await this.getApplicationById(id);
        app.status = 'approved';
        await app.save();
        // Update user's role to 'volunteer'
        await this.authService.updateRoleById(app.userId._id.toString(), 'volunteer');
        return app;
    }

    async rejectApplication(id: string) {
        const app = await this.getApplicationById(id);
        app.status = 'rejected';
        await app.save();
        // Reset user's role to 'user' if application is rejected
        await this.authService.updateRoleById(app.userId._id.toString(), 'user');
        return app;
    }
}
