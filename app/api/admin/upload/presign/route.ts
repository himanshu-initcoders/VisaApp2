import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generatePresignedUploadUrl, getPublicS3Url, validateFileSize, type S3Folder } from '@/lib/s3';

/**
 * POST /api/admin/upload/presign
 *
 * Generate presigned S3 URL for direct browser upload
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { filename, fileType, folder, fileSize } = body;

    // Validate required fields
    if (!filename || !fileType || !folder) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, fileType, folder' },
        { status: 400 }
      );
    }

    // Validate folder type
    const validFolders: S3Folder[] = ['visa-cards', 'visa-heroes', 'visa-gallery'];
    if (!validFolders.includes(folder)) {
      return NextResponse.json(
        { error: `Invalid folder. Must be one of: ${validFolders.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPG, PNG, and WebP images are allowed' },
        { status: 400 }
      );
    }

    // Validate file size if provided
    if (fileSize) {
      try {
        validateFileSize(fileSize, folder);
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'File size validation failed' },
          { status: 400 }
        );
      }
    }

    // Generate presigned URL
    const { url, key } = await generatePresignedUploadUrl(filename, fileType, folder);
    const publicUrl = getPublicS3Url(key);

    return NextResponse.json({
      success: true,
      data: {
        uploadUrl: url,
        s3Key: key,
        publicUrl: publicUrl,
      },
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate upload URL',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
