import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RateHelpRequestDto {
    @IsInt()
    @Min(1)
    @Max(5)
    @Type(() => Number)
    score: number;

    @IsOptional()
    @IsString()
    comment?: string;
}
