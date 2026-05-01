import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AdminModule } from './admin/admin.module';
import { AlertsModule } from './alerts/alerts.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticationModule } from './authentication/authentication.module';
import { ChatModule } from './chat/chat.module';
import { CommunitiesModule } from './communities/communities.module';

import { HelpRequestsModule } from './help-requests/help-requests.module';
import { HelpsModule } from './helps/helps.module';
import { MapModule } from './map/map.module';
import { UserModule } from './user/user.module';
import { VolunteerModule } from './volunteer/volunteer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>('MONGODB_URL');

        if (!uri) {
          throw new Error(
            'MONGODB_URL is not set. Add it to the Render service environment variables.',
          );
        }

        return {
          uri,
          lazyConnection: true,
          serverSelectionTimeoutMS: 10000,
          connectTimeoutMS: 10000,
          connectionFactory: (connection: Connection) => {
            connection.on('connected', () => console.log('MongoDB connected'));
            connection.on('disconnected', () =>
              console.warn('MongoDB disconnected'),
            );
            connection.on('error', (error) =>
              console.error('MongoDB connection error:', error.message),
            );
            return connection;
          },
        };
      },
    }),
    UserModule,
    HelpsModule,
    AuthenticationModule,
    VolunteerModule,
    AdminModule,
    ChatModule,

    HelpRequestsModule,
    AlertsModule,
    CommunitiesModule,
    MapModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
