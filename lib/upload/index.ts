/**
 * Upload Service - Main Module
 *
 * Unified upload interface with support for multiple providers:
 * - Local filesystem
 * - AWS S3
 * - Cloudinary
 *
 * Features:
 * - Automatic old image deletion when replacing
 * - Folder-based organization
 * - Environment-based provider selection
 * - Type-safe API
 */

import { IUploadProvider, UploadProvider, UploadOptions, UploadResult, ReplaceImageOptions, DeleteOptions } from './types';
import { S3UploadProvider } from './providers/s3';
import { LocalUploadProvider } from './providers/local';
import { CloudinaryUploadProvider } from './providers/cloudinary';

class UploadService {
  private provider: IUploadProvider;
  private defaultProvider: UploadProvider;

  constructor() {
    this.defaultProvider = this.getProviderFromEnv();
    this.provider = this.createProvider(this.defaultProvider);
  }

  /**
   * Get upload provider from environment variable
   */
  private getProviderFromEnv(): UploadProvider {
    const envProvider = process.env.UPLOAD_PROVIDER?.toLowerCase() as UploadProvider;

    if (!envProvider) {
      console.warn('UPLOAD_PROVIDER not set, defaulting to "local"');
      return 'local';
    }

    if (!['local', 's3', 'cloudinary'].includes(envProvider)) {
      console.warn(`Invalid UPLOAD_PROVIDER "${envProvider}", defaulting to "local"`);
      return 'local';
    }

    return envProvider;
  }

  /**
   * Create provider instance
   */
  private createProvider(name: UploadProvider): IUploadProvider {
    switch (name) {
      case 's3':
        return new S3UploadProvider();
      case 'cloudinary':
        return new CloudinaryUploadProvider();
      case 'local':
      default:
        return new LocalUploadProvider();
    }
  }

  /**
   * Extract provider and key from a URL
   * Useful for determining which provider to use for deletion
   */
  private parseUrl(url: string): { provider: UploadProvider; key: string } | null {
    try {
      // S3 URL patterns
      if (url.includes('.s3.') && url.includes('.amazonaws.com')) {
        const urlObj = new URL(url);
        const key = urlObj.pathname.substring(1); // Remove leading /
        return { provider: 's3', key };
      }

      // Cloudinary URL pattern
      if (url.includes('res.cloudinary.com')) {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        // Format: /cloud_name/resource_type/upload/v1234567890/folder/file.ext
        const uploadIndex = pathParts.indexOf('upload');
        if (uploadIndex !== -1 && uploadIndex + 1 < pathParts.length) {
          const key = pathParts.slice(uploadIndex + 2).join('/'); // Skip version number
          return { provider: 'cloudinary', key: key.replace(/\.[^/.]+$/, '') }; // Remove extension
        }
      }

      // Local URL pattern
      if (url.startsWith('/uploads/') || url.includes('/uploads/')) {
        const key = url.split('/uploads/')[1];
        return { provider: 'local', key };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Upload a file
   */
  async upload(file: File | Buffer, options: UploadOptions): Promise<UploadResult> {
    console.log(`[Upload] Uploading to ${this.provider.name} provider`);
    return await this.provider.upload(file, options);
  }

  /**
   * Delete a file
   */
  async delete(options: DeleteOptions): Promise<boolean> {
    const { key, provider: specifiedProvider } = options;

    // Use specified provider or default
    const providerToUse = specifiedProvider || this.defaultProvider;
    const providerInstance = providerToUse === this.defaultProvider
      ? this.provider
      : this.createProvider(providerToUse);

    console.log(`[Upload] Deleting from ${providerToUse} provider: ${key}`);
    return await providerInstance.delete(key);
  }

  /**
   * Delete a file by URL (auto-detects provider)
   */
  async deleteByUrl(url: string): Promise<boolean> {
    const parsed = this.parseUrl(url);

    if (!parsed) {
      console.warn(`[Upload] Could not parse URL: ${url}`);
      return false;
    }

    return await this.delete({
      key: parsed.key,
      provider: parsed.provider,
    });
  }

  /**
   * Replace an image - uploads new image and deletes old one
   * This ensures no orphaned files
   */
  async replaceImage(
    file: File | Buffer,
    options: ReplaceImageOptions
  ): Promise<UploadResult> {
    const { oldKey, ...uploadOptions } = options;

    // Upload new image first
    console.log(`[Upload] Replacing image - uploading new file`);
    const result = await this.upload(file, uploadOptions);

    // Delete old image if it exists
    if (oldKey) {
      console.log(`[Upload] Replacing image - deleting old file: ${oldKey}`);
      const deleted = await this.delete({ key: oldKey });
      if (!deleted) {
        console.warn(`[Upload] Failed to delete old image: ${oldKey}`);
      }
    }

    return result;
  }

  /**
   * Replace an image by URL - uploads new image and deletes old one by URL
   */
  async replaceImageByUrl(
    file: File | Buffer,
    options: UploadOptions,
    oldUrl?: string | null
  ): Promise<UploadResult> {
    // Upload new image first
    console.log(`[Upload] Replacing image by URL - uploading new file`);
    const result = await this.upload(file, options);

    // Delete old image if URL provided
    if (oldUrl) {
      console.log(`[Upload] Replacing image by URL - deleting old file: ${oldUrl}`);
      const deleted = await this.deleteByUrl(oldUrl);
      if (!deleted) {
        console.warn(`[Upload] Failed to delete old image by URL: ${oldUrl}`);
      }
    }

    return result;
  }

  /**
   * Get public URL for a key
   */
  getUrl(key: string): string {
    return this.provider.getUrl(key);
  }

  /**
   * Check if file exists
   */
  async exists(key: string): Promise<boolean> {
    return await this.provider.exists(key);
  }

  /**
   * Get current provider name
   */
  getProviderName(): UploadProvider {
    return this.provider.name;
  }

  /**
   * Get provider instance (for advanced usage)
   */
  getProvider(): IUploadProvider {
    return this.provider;
  }
}

// Export singleton instance
export const uploadService = new UploadService();

// Export types
export * from './types';

// Export providers for direct access if needed
export { S3UploadProvider } from './providers/s3';
export { LocalUploadProvider } from './providers/local';
export { CloudinaryUploadProvider } from './providers/cloudinary';
