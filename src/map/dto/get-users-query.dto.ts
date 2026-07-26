import { IsOptional, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUsersQueryDto {
    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    lat?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    lng?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    radius?: number;

    @IsOptional()
    @IsString()
    role?: string;
}
