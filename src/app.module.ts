import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticationModule } from './authentication/authentication.module';
import { HelpsModule } from './helps/helps.module';
import { UserModule } from './user/user.module';
import { VolunteerModule } from './volunteer/volunteer.module';

@Module({
  imports: [UserModule, HelpsModule, AuthenticationModule, VolunteerModule, ConfigModule.forRoot(), MongooseModule.forRoot(process.env.MONGODB_URL!)],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
