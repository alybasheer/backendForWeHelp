import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { VolunteerMediaService } from './volunteer-media.service';
import { VolunteerController } from './volunteer.controller';
import { VolunteerSchema } from './volunteer.schema';
import { VolunteerService } from './volunteer.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: 'Volunteer', schema: VolunteerSchema }]), AuthenticationModule],
    providers: [VolunteerService, VolunteerMediaService],
    controllers: [VolunteerController],
})
export class VolunteerModule { }
