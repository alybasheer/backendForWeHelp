import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Volunteer, VolunteerDocument } from './volunteer.schema';

@Injectable()
export class VolunteerService {
    constructor(@InjectModel('Volunteer') private volunteerModel: Model<VolunteerDocument>) {}

    async createApplication(userId: string, data: {
        name: string;
        city: string;
        location: string;
        expertise: string;
        reason: string;
        image?: string;
        cnic: string;
    }) {
        const created = new this.volunteerModel({ userId, ...data, status: 'pending' });
        return created.save();
    }

    async findByUser(userId: string) {
        return this.volunteerModel.find({ userId }).exec();
    }

    async findAllPending() {
        return this.volunteerModel.find({ status: 'pending' }).exec();
    }

    async findById(id: string) {
        return this.volunteerModel.findById(id).exec();
    }

    async approve(id: string) {
        const app = await this.findById(id);
        if (!app) throw new NotFoundException('Application not found');
        app.status = 'approved';
        return app.save();
    }

    async reject(id: string) {
        const app = await this.findById(id);
        if (!app) throw new NotFoundException('Application not found');
        app.status = 'rejected';
        return app.save();
    }
}
