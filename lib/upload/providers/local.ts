/**
 * Local Filesystem Upload Provider
 *
 * Saves files to local uploads/ directory
 * Useful for development or self-hosted deployments
 */

import fs from 'fs/promises';
import type { Stats } from 'fs';
import path from 'path';
import { IUploadProvider, UploadResult, UploadOptions } from '../types';

/** Statically scoped so Turbopack does not trace the whole project root. */
const UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');

export class LocalUploadProvider implements IUploadProvider {
  readonly name = 'local' as const;
  private publicUrl: string;

  constructor() {
    // Public URL base (how files are served)
    this.publicUrl = process.env.LOCAL_UPLOAD_URL || '/uploads';
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    return path.join(UPLOAD_ROOT, key);
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

    // Generate unique key (relative path)
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}-${randomString}-${sanitizedFilename}`;

    // Ensure folder exists
    const folderPath = path.join(UPLOAD_ROOT, folder);
    await this.ensureDir(folderPath);

    // Write file to disk
    const filePath = this.getFilePath(key);
    await fs.writeFile(filePath, buffer);

    // Write metadata file (optional)
    if (metadata) {
      const metadataPath = `${filePath}.meta.json`;
      await fs.writeFile(
        metadataPath,
        JSON.stringify({
          uploadedAt: new Date().toISOString(),
          folder,
          originalFilename,
          mimeType,
          size,
          ...metadata,
        }, null, 2)
      );
    }

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
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);

      // Also delete metadata file if exists
      try {
        await fs.unlink(`${filePath}.meta.json`);
      } catch {
        // Ignore if metadata file doesn't exist
      }

      return true;
    } catch (error) {
      console.error('Local delete error:', error);
      return false;
    }
  }

  getUrl(key: string): string {
    // Return public URL path
    return `${this.publicUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file stats (size, modified date, etc.)
   */
  async getStats(key: string): Promise<Stats | null> {
    try {
      const filePath = this.getFilePath(key);
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }

  /**
   * List files in a folder
   */
  async listFiles(folder: string): Promise<string[]> {
    try {
      const folderPath = path.join(UPLOAD_ROOT, folder);
      const files = await fs.readdir(folderPath);
      return files
        .filter(f => !f.endsWith('.meta.json'))
        .map(f => `${folder}/${f}`);
    } catch {
      return [];
    }
  }
}
