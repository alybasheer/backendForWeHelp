import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminModule } from './admin/admin.module';
import { AlertsModule } from './alerts/alerts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticationModule } from './authentication/authentication.module';
import { ChatModule } from './chat/chat.module';
import { CommunitiesModule } from './communities/communities.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HelpRequestsModule } from './help-requests/help-requests.module';
import { HelpsModule } from './helps/helps.module';
import { MapModule } from './map/map.module';
import { UserModule } from './user/user.module';
import { VolunteerModule } from './volunteer/volunteer.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URL!),
    UserModule,
    HelpsModule,
    AuthenticationModule,
    VolunteerModule,
    AdminModule,
    ChatModule,
    FirebaseModule,
    HelpRequestsModule,
    AlertsModule,
    CommunitiesModule,
    MapModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
