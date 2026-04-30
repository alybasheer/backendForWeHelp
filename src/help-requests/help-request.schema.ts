import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HelpRequestDocument = HelpRequest & Document;

@Schema({ timestamps: true })
export class HelpRequest {
    @Prop({ type: Types.ObjectId, ref: 'Signup', required: true })
    userId: Types.ObjectId;

    @Prop({ required: false })
    title?: string;

    @Prop({ required: true })
    category: string;

    @Prop({ required: true })
    subCategory: string;

    @Prop({ required: true })
    description: string;

    @Prop({ required: false })
    image?: string;

    @Prop({ required: false })
    locationName?: string;

    @Prop({ required: true, default: false })
    isSos: boolean;

    /**
     * GeoJSON Point for MongoDB geospatial queries.
     * Stored as: { type: 'Point', coordinates: [longitude, latitude] }
     */
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

    @Prop({ required: true, default: 'open', enum: ['open', 'accepted', 'resolved'] })
    status: string;

    @Prop({ type: Types.ObjectId, ref: 'Signup', required: false })
    acceptedBy?: Types.ObjectId;

    /**
     * TTL field — MongoDB automatically deletes the document
     * when the current time exceeds this value.
     */
    @Prop({ required: true })
    expiresAt: Date;
}

export const HelpRequestSchema = SchemaFactory.createForClass(HelpRequest);

// 2dsphere index for geospatial $near queries
HelpRequestSchema.index({ location: '2dsphere' });

// TTL index — MongoDB auto-deletes documents after expiresAt
HelpRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for filtered queries (find open requests near a location)
HelpRequestSchema.index({ status: 1, location: '2dsphere' });
