import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityMessageSchema, CommunitySchema } from './community.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'Community', schema: CommunitySchema },
            { name: 'CommunityMessage', schema: CommunityMessageSchema },
        ]),
        AuthenticationModule,
    ],
    controllers: [CommunitiesController],
    providers: [CommunitiesService, JwtAuthGuard],
})
export class CommunitiesModule {}
