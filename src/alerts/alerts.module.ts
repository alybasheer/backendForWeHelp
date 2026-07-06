import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { ChatModule } from '../chat/chat.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AlertSchema } from './dto/alert.schema';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Alert', schema: AlertSchema }]),
        AuthenticationModule,
        ChatModule,
    ],
    controllers: [AlertsController],
    providers: [AlertsService, JwtAuthGuard],
})
export class AlertsModule {}
