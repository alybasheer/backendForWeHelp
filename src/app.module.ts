import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticationModule } from './authentication/authentication.module';
import { ChatModule } from './chat/chat.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HelpsModule } from './helps/helps.module';
import { UserModule } from './user/user.module';
import { VolunteerModule } from './volunteer/volunteer.module';

@Module({
  imports: [UserModule, HelpsModule, AuthenticationModule, VolunteerModule, AdminModule, ChatModule, FirebaseModule, ConfigModule.forRoot(), MongooseModule.forRoot(process.env.MONGODB_URL!)],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
