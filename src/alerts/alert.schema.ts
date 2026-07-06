import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AlertDocument = Alert & Document;

@Schema({ timestamps: true })
export class Alert {
    @Prop({ type: Types.ObjectId, ref: 'Signup', required: true })
    createdBy: Types.ObjectId;

    @Prop({ required: true })
    title: string;

    @Prop({ required: true })
    description: string;

    @Prop({ required: true })
    locationName: string;

    @Prop({
        type: {
            type: String,
            enum: ['Point'],
            required: true,
        },
        coordinates: {
            type: [Number],
            required: true,
        },
    })
    location: { type: string; coordinates: number[] };

    @Prop({ required: true })
    expiresAt: Date;
}

export const AlertSchema = SchemaFactory.createForClass(Alert);

AlertSchema.index({ location: '2dsphere' });
AlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
