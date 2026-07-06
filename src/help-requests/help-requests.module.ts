import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { SignupSchema } from '../authentication/signup.schema';
import { ChatModule } from '../chat/chat.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RatingsModule } from '../ratings/ratings.module';
import { VolunteerSchema } from '../volunteer/volunteer.schema';
import { HelpRequestSchema } from './help-request.schema';
import { HelpRequestMediaService } from './help-request-media.service';
import { HelpRequestsController } from './help-requests.controller';
import { HelpRequestsService } from './help-requests.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'HelpRequest', schema: HelpRequestSchema },
            { name: 'Signup', schema: SignupSchema },
            { name: 'Volunteer', schema: VolunteerSchema },
        ]),
        AuthenticationModule, // provides JwtModule + AuthenticationService
        ChatModule,           // for real-time notifications via ChatGateway
        RatingsModule,
    ],
    providers: [HelpRequestsService, HelpRequestMediaService, JwtAuthGuard],
    controllers: [HelpRequestsController],
    exports: [HelpRequestsService],
})
export class HelpRequestsModule {}
