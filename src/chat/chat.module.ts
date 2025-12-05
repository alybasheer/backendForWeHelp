import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { SignupSchema } from '../authentication/signup.schema';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { MessageSchema } from './chat.schema';
import { ChatService } from './chat.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'Message', schema: MessageSchema },
            { name: 'Signup', schema: SignupSchema },
        ]),
        JwtModule.register({
            secret: process.env.JWT_SECRET ?? 'dev_secret_key',
        }),
    ],
    providers: [ChatGateway, ChatService],
    controllers: [ChatController],
    exports: [ChatService],
})
export class ChatModule { }
