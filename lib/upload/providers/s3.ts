/**
 * AWS S3 Upload Provider
 *
 * Handles file uploads to Amazon S3
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IUploadProvider, UploadResult, UploadOptions } from '../types';

export class S3UploadProvider implements IUploadProvider {
  readonly name = 's3' as const;
  private client: S3Client;
  private bucket: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'ap-south-1';
    this.bucket = process.env.AWS_S3_BUCKET_NAME!;

    if (!this.bucket) {
      throw new Error('AWS_S3_BUCKET_NAME environment variable is required');
    }

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(file: File | Buffer, options: UploadOptions): Promise<UploadResult> {
    const { folder, filename: customFilename, metadata } = options;

    // Get file data
    let buffer: Buffer;
    let originalFilename: string;
    let mimeType: string;
    let size: number;

    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer());
      originalFilename = file.name;
      mimeType = file.type;
      size = file.size;
    } else {
      buffer = file;
      originalFilename = customFilename || 'upload';
      mimeType = options.allowedTypes?.[0] || 'application/octet-stream';
      size = buffer.length;
    }

    // Validate file size
    const maxSizeMB = options.maxSizeMB || 10;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (size > maxSizeBytes) {
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }

    // Validate file type
    if (options.allowedTypes && !options.allowedTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} not allowed`);
    }

    // Generate unique key
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const extension = mimeType.split('/')[1] || 'bin';
    const key = `${folder}/${timestamp}-${randomString}-${sanitizedFilename}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        folder,
        originalFilename,
        ...metadata,
      },
    });

    await this.client.send(command);

    // Return result
    return {
      url: this.getUrl(key),
      key,
      provider: this.name,
      folder,
      filename: originalFilename,
      size,
      mimeType,
    };
  }

  async delete(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      return false;
    }
  }

  getUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate presigned URL for direct browser upload
   */
  async generatePresignedUrl(
    filename: string,
    fileType: string,
    folder: string
  ): Promise<{ url: string; key: string }> {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}-${randomString}-${sanitizedFilename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: fileType,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });

    return { url, key };
  }
}
