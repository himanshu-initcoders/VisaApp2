/**
 * Upload Server Actions
 *
 * Server actions for handling file uploads with the unified upload service
 * These run on the server and can be called from client components
 */

'use server';

import { uploadService, UploadOptions, UploadResult } from './index';
import { requireRole } from '@/lib/auth-utils';

/**
 * Upload a file (requires admin role)
 */
export async function uploadFile(
  fileData: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    size: number;
  },
  options: UploadOptions
): Promise<{ success: true; result: UploadResult } | { success: false; error: string }> {
  try {
    await requireRole(['admin']);

    // Convert buffer data to Buffer instance
    const buffer = Buffer.from(fileData.buffer);

    // Upload using service
    const result = await uploadService.upload(buffer, options);

    return { success: true, result };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Delete a file by key (requires admin role)
 */
export async function deleteFile(
  key: string,
  provider?: 'local' | 's3' | 'cloudinary'
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin']);

    const deleted = await uploadService.delete({ key, provider });

    if (!deleted) {
      return { success: false, error: 'File not found or could not be deleted' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Delete a file by URL (auto-detects provider)
 */
export async function deleteFileByUrl(
  url: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin']);

    const deleted = await uploadService.deleteByUrl(url);

    if (!deleted) {
      return { success: false, error: 'File not found or could not be deleted' };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete by URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Delete failed',
    };
  }
}

/**
 * Replace an existing file with a new one (uploads new, deletes old)
 */
export async function replaceFile(
  fileData: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    size: number;
  },
  options: UploadOptions,
  oldKey?: string | null
): Promise<{ success: true; result: UploadResult } | { success: false; error: string }> {
  try {
    await requireRole(['admin']);

    const buffer = Buffer.from(fileData.buffer);

    // Use replaceImage which handles deletion automatically
    const result = await uploadService.replaceImage(buffer, {
      ...options,
      oldKey: oldKey || undefined,
    });

    return { success: true, result };
  } catch (error) {
    console.error('Replace error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Replace failed',
    };
  }
}

/**
 * Replace file by URL (auto-detects provider for deletion)
 */
export async function replaceFileByUrl(
  fileData: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    size: number;
  },
  options: UploadOptions,
  oldUrl?: string | null
): Promise<{ success: true; result: UploadResult } | { success: false; error: string }> {
  try {
    await requireRole(['admin']);

    const buffer = Buffer.from(fileData.buffer);

    const result = await uploadService.replaceImageByUrl(
      buffer,
      options,
      oldUrl || undefined
    );

    return { success: true, result };
  } catch (error) {
    console.error('Replace by URL error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Replace failed',
    };
  }
}

/**
 * Get current upload provider name
 */
export async function getUploadProvider(): Promise<string> {
  return uploadService.getProviderName();
}

/**
 * Check if file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    await requireRole(['admin']);
    return await uploadService.exists(key);
  } catch {
    return false;
  }
}
