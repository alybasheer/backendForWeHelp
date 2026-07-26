import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { SignupSchema } from '../authentication/signup.schema';
import { ChatModule } from '../chat/chat.module';
import { RoutingService } from '../common/services/routing.service';
import { MapController } from './map.controller';
import { MapService } from './map.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Signup', schema: SignupSchema }]),
        AuthenticationModule,
        ChatModule,
    ],
    controllers: [MapController],
    providers: [MapService, RoutingService],
})
export class MapModule {}
