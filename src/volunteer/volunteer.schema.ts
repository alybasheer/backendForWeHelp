import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VolunteerDocument = Volunteer & Document;

@Schema({ timestamps: true })
export class Volunteer {
    @Prop({ type: Types.ObjectId, ref: 'Signup', required: true })
    userId: Types.ObjectId;

    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    city: string;

    @Prop({ required: true })
    location: string;

    @Prop({ required: true })
    expertise: string;

    @Prop({ required: true })
    reason: string;

    @Prop({ required: false })
    image: string;

    @Prop({ required: true })
    cnic: string;

    @Prop({ required: true, default: 'pending' })
    status: string; // pending | approved | rejected
}

export const VolunteerSchema = SchemaFactory.createForClass(Volunteer);
