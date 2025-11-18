import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { VolunteerController } from './volunteer.controller';
import { VolunteerSchema } from './volunteer.schema';
import { VolunteerService } from './volunteer.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: 'Volunteer', schema: VolunteerSchema }]), AuthenticationModule],
    providers: [VolunteerService],
    controllers: [VolunteerController],
})
export class VolunteerModule { }
