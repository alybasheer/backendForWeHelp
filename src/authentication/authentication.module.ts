import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { SignupSchema } from './signup.schema';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: 'Signup', schema: SignupSchema }]),
        JwtModule.register({
            secret: process.env.JWT_SECRET ?? 'dev_secret_key',
            signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '1h') as any },
        }),
    ],
    providers: [AuthenticationService],
    controllers: [AuthenticationController],
    exports: [AuthenticationService, JwtModule],
})
export class AuthenticationModule { }
