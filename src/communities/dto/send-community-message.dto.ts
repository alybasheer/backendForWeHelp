import { IsNotEmpty, IsString } from 'class-validator';

export class SendCommunityMessageDto {
    @IsString()
    @IsNotEmpty()
    content: string;
}
