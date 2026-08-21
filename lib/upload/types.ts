/**
 * Upload Module Types
 *
 * Defines interfaces for multi-provider upload system
 */

export type UploadProvider = 'local' | 's3' | 'cloudinary';

export type UploadFolder =
  | 'visa-cards'
  | 'visa-heroes'
  | 'visa-gallery'
  | 'country-banners'
  | 'country-heroes'
  | 'country-flags'
  | 'documents'
  | 'passports'
  | 'photos';

export interface UploadResult {
  url: string;           // Public URL to access the file
  key: string;           // Unique identifier (S3 key, Cloudinary public_id, or local path)
  provider: UploadProvider;
  folder: UploadFolder;
  filename: string;      // Original filename
  size: number;          // File size in bytes
  mimeType: string;      // MIME type
  width?: number;        // Image width (if available)
  height?: number;       // Image height (if available)
}

export interface UploadOptions {
  folder: UploadFolder;
  filename?: string;     // Optional custom filename
  maxSizeMB?: number;    // Max file size in MB
  allowedTypes?: string[]; // Allowed MIME types
  metadata?: Record<string, string>; // Additional metadata
}

export interface DeleteOptions {
  key: string;           // File identifier to delete
  provider?: UploadProvider; // Optional: specify provider if different from default
}

export interface IUploadProvider {
  /**
   * Upload a file
   */
  upload(file: File | Buffer, options: UploadOptions): Promise<UploadResult>;

  /**
   * Delete a file
   */
  delete(key: string): Promise<boolean>;

  /**
   * Get public URL for a file
   */
  getUrl(key: string): string;

  /**
   * Check if file exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Provider name
   */
  readonly name: UploadProvider;
}

export interface ReplaceImageOptions extends UploadOptions {
  oldKey?: string | null; // Key of old image to delete
}
