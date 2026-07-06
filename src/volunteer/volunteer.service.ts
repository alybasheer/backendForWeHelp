import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthenticationService } from '../authentication/authentication.service';
import { VolunteerDocument } from './volunteer.schema';

@Injectable()
export class VolunteerService {
  constructor(
    @InjectModel('Volunteer') private volunteerModel: Model<VolunteerDocument>,
    private readonly authService: AuthenticationService,
  ) {}

  async createApplication(
    userId: string,
    data: {
      name: string;
      city: string;
      location: string;
      expertise: string;
      reason: string;
      cnic: string;
      cnicFrontImage: string;
      cnicBackImage: string;
      profileImage?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const created = new this.volunteerModel({
      userId,
      ...data,
      status: 'pending',
    });
    const saved = await created.save();
    if (data.profileImage) {
      await this.authService.updateProfileImageById(userId, data.profileImage);
    }
    if (
      typeof data.latitude === 'number' &&
      typeof data.longitude === 'number'
    ) {
      await this.authService.updateLocationById(
        userId,
        data.latitude,
        data.longitude,
      );
    }
    return saved;
  }

  async findByUser(userId: string) {
    return this.volunteerModel.find({ userId }).exec();
  }

  async findByUserId(userId: string) {
    // Find the most recent volunteer application for the user
    return this.volunteerModel
      .findOne({ userId })
      .sort({ createdAt: -1 })
      .exec();
  }
  async getVolunteerStatus(userId: string) {
  const verification = await this.volunteerModel
    .findOne({ userId })
    .sort({ createdAt: -1 })
    .exec();

  if (!verification) {
    return {
      status: 'pending',
      message: 'No application found. User can submit a new application.',
    };
  }

  return verification;
}
}
