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
export class HelpRequestMediaService {
  private static readonly bucketName = 'help_request_media';
  private static readonly maxFiles = 2;
  private static readonly maxFileSizeBytes = 5 * 1024 * 1024;

  constructor(@InjectConnection() private readonly connection: Connection) {}

  async upload(files: any[] | undefined, baseUrl: string) {
    if (!files?.length) {
      throw new BadRequestException('At least one image is required');
    }

    if (files.length > HelpRequestMediaService.maxFiles) {
      throw new BadRequestException('You can upload up to 2 images');
    }

    const bucket = this.getBucket();
    const mediaUrls: string[] = [];

    for (const file of files) {
      this.validateFile(file);
      const id = await this.uploadFile(bucket, file);
      mediaUrls.push(`${baseUrl}/help-requests/media/${id.toString()}`);
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
      .collection(`${HelpRequestMediaService.bucketName}.files`)
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

    if (file.size > HelpRequestMediaService.maxFileSizeBytes) {
      throw new BadRequestException('Each image must be 5MB or less');
    }
  }

  private uploadFile(bucket: GridFSBucket, file: any) {
    return new Promise<ObjectId>((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(
        file.originalname || 'request-image',
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
      bucketName: HelpRequestMediaService.bucketName,
    });
  }

  private getDb() {
    if (!this.connection.db) {
      throw new BadRequestException('Database connection is not ready');
    }

    return this.connection.db;
  }
}
