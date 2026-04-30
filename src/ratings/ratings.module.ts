import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RatingSchema } from './rating.schema';
import { RatingsService } from './ratings.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: 'Rating', schema: RatingSchema }])],
    providers: [RatingsService],
    exports: [RatingsService],
})
export class RatingsModule {}
