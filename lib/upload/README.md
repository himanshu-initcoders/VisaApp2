# Upload Module Documentation

A unified, flexible upload system that supports multiple storage providers with automatic old image cleanup.

## Features

✅ **Multi-Provider Support**
- Local filesystem (`uploads/` folder)
- AWS S3
- Cloudinary

✅ **Automatic Old Image Deletion**
- When replacing images, old files are automatically deleted
- No orphaned files or storage waste

✅ **Folder-Based Organization**
- Organized by content type (visa-cards, country-banners, etc.)
- Easy to manage and maintain

✅ **Environment-Based Configuration**
- Switch providers via environment variable
- No code changes needed

✅ **Type-Safe API**
- Full TypeScript support
- Consistent interface across providers

## Environment Variables

### Provider Selection

```env
# Choose provider: local, s3, or cloudinary
UPLOAD_PROVIDER=local
```

### Local Filesystem

```env
# Optional: custom upload directory (default: public/uploads)
LOCAL_UPLOAD_DIR=public/uploads

# Optional: custom public URL base (default: /uploads)
LOCAL_UPLOAD_URL=/uploads
```

### AWS S3

```env
UPLOAD_PROVIDER=s3

AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET_NAME=your_bucket_name
```

### Cloudinary

```env
UPLOAD_PROVIDER=cloudinary

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Note:** For Cloudinary, install the package first:
```bash
npm install cloudinary
```

## Usage

### Server Actions (Recommended)

Use the pre-built server actions for most use cases:

```typescript
import { replaceFileByUrl, uploadFile, deleteFileByUrl } from '@/lib/upload/server-actions';

// Upload new file and auto-delete old one
const result = await replaceFileByUrl(
  {
    buffer: fileBuffer,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  },
  {
    folder: 'country-banners',
    maxSizeMB: 5,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  oldImageUrl // Will be deleted automatically
);

if (result.success) {
  console.log('New image URL:', result.result.url);
}
```

### Direct Service Usage

For advanced use cases, use the service directly:

```typescript
import { uploadService } from '@/lib/upload';

// Simple upload
const result = await uploadService.upload(file, {
  folder: 'visa-cards',
  maxSizeMB: 2,
});

// Replace image (auto-deletes old)
const result = await uploadService.replaceImage(file, {
  folder: 'country-heroes',
  oldKey: 'country-heroes/old-image.jpg', // Will be deleted
});

// Delete by URL (auto-detects provider)
await uploadService.deleteByUrl('https://bucket.s3.region.amazonaws.com/path/to/file.jpg');
```

## Components

### ImageUploadV2 Component

Pre-built React component with automatic old image deletion:

```tsx
import { ImageUploadV2 } from '@/components/admin/config/ImageUploadV2';

<ImageUploadV2
  label="Banner Image"
  description="Portrait orientation • 3:4 aspect ratio"
  currentImageUrl={country.bannerImageUrl} // Old image to replace
  altText={country.bannerImageAlt || ''}
  dimensions={{ width: country.bannerImageWidth, height: country.bannerImageHeight }}
  onSuccess={(url, alt, dims) => {
    // Update database with new URL
    updateCountry({ bannerImageUrl: url, bannerImageAlt: alt, ...dims });
  }}
  folder="country-banners"
  aspectRatio="3/4"
  maxSizeMB={5}
/>
```

**Key Features:**
- ✅ Drag-and-drop support
- ✅ Live preview
- ✅ Alt text input
- ✅ Optional dimensions
- ✅ Automatic old image deletion
- ✅ Upload progress indicator
- ✅ Success confirmation

## Folder Types

Available folder types for organization:

```typescript
type UploadFolder =
  | 'visa-cards'        // Visa card images
  | 'visa-heroes'       // Visa hero banners
  | 'visa-gallery'      // Visa gallery images
  | 'country-banners'   // Country portrait banners
  | 'country-heroes'    // Country landscape heroes
  | 'country-flags'     // Country flag logos
  | 'documents'         // User uploaded documents
  | 'passports'         // Passport scans
  | 'photos'            // Profile/application photos
```

## File Size Limits

Default limits per folder (configurable):

- `visa-cards`: 2MB
- `visa-heroes`: 5MB
- `visa-gallery`: 3MB
- `country-banners`: 5MB
- `country-heroes`: 5MB
- `country-flags`: 1MB
- `documents`: 10MB
- `passports`: 5MB
- `photos`: 2MB

## Allowed File Types

Default: `['image/jpeg', 'image/jpg', 'image/png', 'image/webp']`

Can be customized per upload:

```typescript
await uploadService.upload(file, {
  folder: 'documents',
  allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
});
```

## Architecture

### Directory Structure

```
lib/upload/
├── index.ts                  # Main service & exports
├── types.ts                  # TypeScript interfaces
├── server-actions.ts         # Server actions for client usage
├── providers/
│   ├── s3.ts                # AWS S3 implementation
│   ├── cloudinary.ts        # Cloudinary implementation
│   └── local.ts             # Local filesystem implementation
└── README.md                # This file
```

### Provider Interface

All providers implement the `IUploadProvider` interface:

```typescript
interface IUploadProvider {
  upload(file: File | Buffer, options: UploadOptions): Promise<UploadResult>;
  delete(key: string): Promise<boolean>;
  getUrl(key: string): string;
  exists(key: string): Promise<boolean>;
  readonly name: UploadProvider;
}
```

### Upload Flow

1. **Select Provider** - Based on `UPLOAD_PROVIDER` environment variable
2. **Upload New File** - To selected provider (S3, Cloudinary, or local)
3. **Get Public URL** - Provider returns public URL
4. **Delete Old File** - Automatically if using `replaceImage()` methods
5. **Return Result** - New URL, key, and metadata

### Automatic Deletion Logic

When using `replaceImage*` methods:

1. New image uploads first (fail-safe)
2. If upload succeeds, old image is deleted
3. If upload fails, old image remains (no data loss)

## Migration Guide

### From Old S3 Module

**Before:**
```typescript
import { generatePresignedUploadUrl, getPublicS3Url } from '@/lib/s3';

const { url, key } = await generatePresignedUploadUrl(filename, fileType, folder);
// Client uploads to S3
const publicUrl = getPublicS3Url(key);
```

**After:**
```typescript
import { replaceFileByUrl } from '@/lib/upload/server-actions';

const result = await replaceFileByUrl(fileData, { folder }, oldUrl);
// Done! Upload and deletion handled automatically
```

### Key Differences

| Old Approach | New Module |
|--------------|------------|
| Manual presigned URL generation | Automatic upload handling |
| Client-side S3 upload | Server-side upload (all providers) |
| Manual old image deletion | Automatic cleanup |
| S3 only | Multi-provider (local, S3, Cloudinary) |
| Multiple steps | Single function call |

## Best Practices

### 1. Always Use Replace Methods

**❌ Don't:**
```typescript
await uploadService.upload(newFile, { folder: 'banners' });
// Old image still exists! Storage waste!
```

**✅ Do:**
```typescript
await uploadService.replaceImageByUrl(newFile, { folder: 'banners' }, oldUrl);
// Old image automatically deleted ✓
```

### 2. Handle Upload Errors

```typescript
try {
  const result = await replaceFileByUrl(fileData, options, oldUrl);
  if (!result.success) {
    console.error(result.error);
    // Handle error
  }
} catch (error) {
  // Handle network/server errors
}
```

### 3. Validate Before Upload

```typescript
// Client-side validation
if (file.size > 5 * 1024 * 1024) {
  alert('File too large');
  return;
}

if (!file.type.startsWith('image/')) {
  alert('Must be an image');
  return;
}
```

### 4. Use Correct Folders

Organize uploads by content type:
- Country images → `country-banners`, `country-heroes`, `country-flags`
- Visa images → `visa-cards`, `visa-heroes`, `visa-gallery`
- User uploads → `documents`, `passports`, `photos`

## Troubleshooting

### Error: "UPLOAD_PROVIDER not set"

**Solution:** Add to `.env`:
```env
UPLOAD_PROVIDER=local
```

### Error: "AWS credentials missing"

**Solution:** When using `UPLOAD_PROVIDER=s3`, ensure:
```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET_NAME=xxx
```

### Error: "Cloudinary package not installed"

**Solution:**
```bash
npm install cloudinary
```

### Old images not being deleted

**Check:**
1. Are you using `replaceImage*` methods? (not plain `upload`)
2. Is the old URL/key correct?
3. Check server logs for deletion errors

### Images not showing after upload

**Check:**
1. For local: Ensure `public/uploads/` exists and is served statically
2. For S3: Ensure bucket has public read permissions
3. For Cloudinary: Check API credentials

## Testing

### Test Local Upload

```typescript
// Set in .env
UPLOAD_PROVIDER=local

// Upload will save to: public/uploads/country-banners/
// URL will be: /uploads/country-banners/file.jpg
```

### Test S3 Upload

```typescript
// Set in .env
UPLOAD_PROVIDER=s3

// Upload will save to S3 bucket
// URL will be: https://bucket.s3.region.amazonaws.com/...
```

### Test Deletion

```typescript
const result = await uploadService.upload(file, { folder: 'test' });
console.log('Uploaded:', result.url);

const deleted = await uploadService.delete({ key: result.key });
console.log('Deleted:', deleted); // Should be true
```

## Performance

### Provider Comparison

| Provider | Upload Speed | Deletion Speed | CDN | Cost |
|----------|--------------|----------------|-----|------|
| Local | ⚡ Fastest | ⚡ Instant | ❌ No | 💰 Free |
| S3 | ✅ Fast | ✅ Fast | ✅ CloudFront | 💰💰 Pay-as-you-go |
| Cloudinary | ✅ Fast | ✅ Fast | ✅ Built-in | 💰💰 Tiered |

### Recommendations

- **Development:** Use `local` for speed and simplicity
- **Production (small):** Use `local` with CDN (Vercel/Cloudflare)
- **Production (large):** Use `S3` with CloudFront CDN
- **Image-heavy:** Use `Cloudinary` for transformations

## Security

### File Validation

Always validate:
- ✅ File type (MIME type)
- ✅ File size
- ✅ File extension
- ✅ User authentication
- ✅ User authorization

### Best Practices

1. **Validate server-side** (client validation can be bypassed)
2. **Limit file sizes** appropriately
3. **Scan for malware** in production (AWS Macie, ClamAV)
4. **Use signed URLs** for sensitive uploads (S3 presigned URLs)
5. **Set CORS policies** correctly

## Future Enhancements

Planned features:

- [ ] Azure Blob Storage provider
- [ ] Google Cloud Storage provider
- [ ] Image optimization (auto-resize, format conversion)
- [ ] Automatic backups
- [ ] Upload progress tracking
- [ ] Bulk operations
- [ ] Image transformations (crop, resize, watermark)

## Support

For issues or questions:
1. Check this README first
2. Review environment variables
3. Check server logs
4. Test with `local` provider to isolate issues

## License

Part of Visa & Passport Service Platform
