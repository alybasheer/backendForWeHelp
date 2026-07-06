import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RatingDocument = Rating & Document;

@Schema({ timestamps: true })
export class Rating {
    @Prop({ type: Types.ObjectId, ref: 'HelpRequest', required: true })
    requestId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Signup', required: true })
    requesterId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Signup', required: true })
    volunteerId: Types.ObjectId;

    @Prop({ required: true, min: 1, max: 5 })
    score: number;

    @Prop({ required: false })
    comment?: string;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

RatingSchema.index({ requestId: 1, requesterId: 1 }, { unique: true });
RatingSchema.index({ volunteerId: 1 });
