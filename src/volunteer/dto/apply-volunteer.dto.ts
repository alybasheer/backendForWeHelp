import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyVolunteerDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    city: string;

    @IsString()
    @IsNotEmpty()
    location: string;

    @IsString()
    @IsNotEmpty()
    expertise: string;

    @IsString()
    @IsNotEmpty()
    reason: string;

    @IsString()
    @IsNotEmpty()
    cnic: string;

    @IsString()
    @IsNotEmpty()
    cnicFrontImage: string;

    @IsString()
    @IsNotEmpty()
    cnicBackImage: string;

    @IsOptional()
    @IsString()
    profileImage?: string;
}
