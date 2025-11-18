import { ApiProperty } from '@nestjs/swagger';

export class ApplyVolunteerDto {
    @ApiProperty() name: string;
    @ApiProperty() city: string;
    @ApiProperty() location: string;
    @ApiProperty() expertise: string;
    @ApiProperty() reason: string;
    @ApiProperty({ required: false }) image?: string;
    @ApiProperty() cnic: string;
}
