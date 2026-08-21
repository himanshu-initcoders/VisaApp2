import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * S3 Upload Utilities
 *
 * Handles image uploads for visa listings using presigned URLs
 * Images are uploaded directly from the client to S3 for better performance
 */

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export type S3Folder = 'visa-cards' | 'visa-heroes' | 'visa-gallery' | 'country-banners' | 'country-heroes' | 'country-flags';

/**
 * Generate presigned URL for direct browser upload to S3
 * @param filename - Original filename
 * @param fileType - MIME type (image/jpeg, image/png, etc.)
 * @param folder - S3 folder to upload to
 * @returns Presigned URL and S3 key
 */
export async function generatePresignedUploadUrl(
  filename: string,
  fileType: string,
  folder: S3Folder
): Promise<{ url: string; key: string }> {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(fileType.toLowerCase())) {
    throw new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.');
  }

  // Generate unique key
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const extension = fileType.split('/')[1];
  const key = `${folder}/${timestamp}-${randomString}-${sanitizedFilename}.${extension}`;

  // Create S3 command
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
    ContentType: fileType,
    // Optional: Add metadata
    Metadata: {
      uploadedAt: new Date().toISOString(),
      folder,
    },
  });

  // Generate presigned URL (expires in 1 hour)
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { url, key };
}

/**
 * Generate public URL for uploaded image
 * @param key - S3 key of the uploaded file
 * @returns Public URL to access the file
 */
export function getPublicS3Url(key: string): string {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  const region = process.env.AWS_REGION || 'ap-south-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/**
 * Validate file size based on folder type
 * @param fileSize - File size in bytes
 * @param folder - S3 folder type
 * @returns true if valid, throws error otherwise
 */
export function validateFileSize(fileSize: number, folder: S3Folder): boolean {
  const limits: Record<S3Folder, number> = {
    'visa-cards': 2 * 1024 * 1024, // 2MB
    'visa-heroes': 5 * 1024 * 1024, // 5MB
    'visa-gallery': 3 * 1024 * 1024, // 3MB
    'country-banners': 5 * 1024 * 1024, // 5MB
    'country-heroes': 5 * 1024 * 1024, // 5MB
    'country-flags': 1 * 1024 * 1024, // 1MB
  };

  const limit = limits[folder];
  if (fileSize > limit) {
    throw new Error(`File size exceeds limit of ${limit / (1024 * 1024)}MB for ${folder}`);
  }

  return true;
}
