import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VolunteerDocument } from './volunteer.schema';

@Injectable()
export class VolunteerService {
    constructor(
        @InjectModel('Volunteer') private volunteerModel: Model<VolunteerDocument>,
    ) { }

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

    async findByUserId(userId: string) {
        // Find the most recent volunteer application for the user
        return this.volunteerModel.findOne({ userId }).sort({ createdAt: -1 }).exec();
    }
}
