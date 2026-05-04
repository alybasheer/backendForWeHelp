import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Connection } from 'mongoose';
import { Readable } from 'stream';

@Injectable()
export class VolunteerMediaService {
    private static readonly bucketName = 'volunteer_media';
    private static readonly maxFiles = 3;
    private static readonly maxFileSizeBytes = 5 * 1024 * 1024;

    constructor(@InjectConnection() private readonly connection: Connection) { }

    async upload(files: any[] | undefined, baseUrl: string) {
        if (!files?.length) {
            throw new BadRequestException('At least one image is required');
        }

        if (files.length > VolunteerMediaService.maxFiles) {
            throw new BadRequestException('You can upload up to 3 images');
        }

        const bucket = this.getBucket();
        const mediaUrls: string[] = [];

        for (const file of files) {
            this.validateFile(file);
            const id = await this.uploadFile(bucket, file);
            mediaUrls.push(`${baseUrl}/volunteer/media/${id.toString()}`);
        }

        return mediaUrls;
    }

    async openDownloadStream(id: string) {
        if (!ObjectId.isValid(id)) {
            throw new NotFoundException('Media not found');
        }

        const objectId = new ObjectId(id);
        const db = this.getDb();
        const bucket = this.getBucket();
        const file = await db
            .collection(`${VolunteerMediaService.bucketName}.files`)
            .findOne({ _id: objectId });

        if (!file) {
            throw new NotFoundException('Media not found');
        }

        return {
            contentType: file.contentType || 'application/octet-stream',
            filename: file.filename,
            stream: bucket.openDownloadStream(objectId),
        };
    }

    private validateFile(file: any) {
        if (!file?.buffer?.length) {
            throw new BadRequestException('Invalid image upload');
        }

        if (!file.mimetype?.startsWith('image/')) {
            throw new BadRequestException('Only image uploads are supported');
        }

        if (file.size > VolunteerMediaService.maxFileSizeBytes) {
            throw new BadRequestException('Each image must be 5MB or less');
        }
    }

    private uploadFile(bucket: GridFSBucket, file: any) {
        return new Promise<ObjectId>((resolve, reject) => {
            const uploadStream = bucket.openUploadStream(
                file.originalname || 'volunteer-image',
                {
                    contentType: file.mimetype,
                    metadata: {
                        uploadedAt: new Date(),
                        size: file.size,
                    },
                },
            );

            uploadStream.once('finish', () => resolve(uploadStream.id as ObjectId));
            uploadStream.once('error', reject);
            Readable.from([file.buffer]).pipe(uploadStream);
        });
    }

    private getBucket() {
        return new GridFSBucket(this.getDb(), {
            bucketName: VolunteerMediaService.bucketName,
        });
    }

    private getDb() {
        if (!this.connection.db) {
            throw new BadRequestException('Database connection is not ready');
        }

        return this.connection.db;
    }
}
