import { IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
    @IsString()
    idToken: string; // Firebase ID token from Google Sign-In

    @IsString()
    @IsOptional()
    username?: string; // Optional, can use email if not provided
}
