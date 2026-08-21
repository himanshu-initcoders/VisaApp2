/**
 * Cloudinary Upload Provider
 *
 * Handles file uploads to Cloudinary
 * Requires: npm install cloudinary
 */

import { IUploadProvider, UploadResult, UploadOptions } from '../types';

export class CloudinaryUploadProvider implements IUploadProvider {
  readonly name = 'cloudinary' as const;
  private cloudinary: any;
  private cloudName: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;

    if (!this.cloudName || !apiKey || !apiSecret) {
      throw new Error(
        'Cloudinary credentials missing. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET'
      );
    }

    try {
      // Dynamically import cloudinary
      const cloudinaryModule = require('cloudinary').v2;
      cloudinaryModule.config({
        cloud_name: this.cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.cloudinary = cloudinaryModule;
    } catch (error) {
      throw new Error(
        'Cloudinary package not installed. Run: npm install cloudinary'
      );
    }
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

    // Determine resource type
    const resourceType = mimeType.startsWith('image/') ? 'image' : 'raw';

    // Upload to Cloudinary
    return new Promise((resolve, reject) => {
      const uploadStream = this.cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          context: {
            originalFilename,
            uploadedAt: new Date().toISOString(),
            ...metadata,
          },
          use_filename: true,
          unique_filename: true,
        },
        (error: any, result: any) => {
          if (error) {
            reject(error);
            return;
          }

          resolve({
            url: result.secure_url,
            key: result.public_id,
            provider: this.name,
            folder,
            filename: originalFilename,
            size,
            mimeType,
            width: result.width,
            height: result.height,
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  async delete(key: string): Promise<boolean> {
    try {
      // Determine resource type from public_id
      const isImage = !key.includes('/raw/');
      const resourceType = isImage ? 'image' : 'raw';

      await this.cloudinary.uploader.destroy(key, {
        resource_type: resourceType,
      });

      return true;
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return false;
    }
  }

  getUrl(key: string): string {
    // Construct Cloudinary URL
    const resourceType = key.includes('/raw/') ? 'raw' : 'image';
    return `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const isImage = !key.includes('/raw/');
      const resourceType = isImage ? 'image' : 'raw';

      const result = await this.cloudinary.api.resource(key, {
        resource_type: resourceType,
      });

      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * Get Cloudinary resource details
   */
  async getDetails(key: string): Promise<any> {
    try {
      const isImage = !key.includes('/raw/');
      const resourceType = isImage ? 'image' : 'raw';

      return await this.cloudinary.api.resource(key, {
        resource_type: resourceType,
      });
    } catch {
      return null;
    }
  }

  /**
   * Generate transformation URL for images
   * Example: {width: 800, height: 600, crop: 'fill'}
   */
  getTransformedUrl(key: string, transformations: Record<string, any>): string {
    return this.cloudinary.url(key, transformations);
  }
}
