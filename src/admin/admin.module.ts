import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { VolunteerSchema } from '../volunteer/volunteer.schema';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Volunteer', schema: VolunteerSchema }]),
        JwtModule,
        AuthenticationModule,
    ],
    providers: [AdminService],
    controllers: [AdminController],
})
export class AdminModule { }
