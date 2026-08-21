# Upload Module - Quick Start Guide

Get up and running with the upload module in 5 minutes!

## Step 1: Choose Your Provider

Add to your `.env` file:

```env
# For local development (recommended for getting started)
UPLOAD_PROVIDER=local

# For production with S3
# UPLOAD_PROVIDER=s3
# AWS_REGION=ap-south-1
# AWS_ACCESS_KEY_ID=your_key
# AWS_SECRET_ACCESS_KEY=your_secret
# AWS_S3_BUCKET_NAME=your_bucket

# For production with Cloudinary (requires: npm install cloudinary)
# UPLOAD_PROVIDER=cloudinary
# CLOUDINARY_CLOUD_NAME=your_cloud
# CLOUDINARY_API_KEY=your_key
# CLOUDINARY_API_SECRET=your_secret
```

## Step 2: Use in Your Component

### Example: Image Upload with Auto-Deletion

```tsx
import { ImageUploadV2 } from '@/components/admin/config/ImageUploadV2';

export function MyComponent({ currentImageUrl, onUpdate }: Props) {
  return (
    <ImageUploadV2
      label="Profile Picture"
      description="Square image • Max 2MB"
      currentImageUrl={currentImageUrl}  // Old image (will be deleted automatically)
      onSuccess={(newUrl, altText, dimensions) => {
        // Save new URL to database
        onUpdate({ profileImage: newUrl, altText, ...dimensions });
      }}
      folder="photos"
      aspectRatio="1/1"
      maxSizeMB={2}
    />
  );
}
```

**That's it!** The component handles:
- ✅ File selection
- ✅ Preview
- ✅ Validation
- ✅ Upload to your chosen provider (local/S3/Cloudinary)
- ✅ Automatic deletion of old image
- ✅ Success/error handling

## Step 3: Save to Database

Update your server action to save the new URL:

```typescript
'use server';

export async function updateProfileImage(
  userId: string,
  imageUrl: string,
  altText: string,
  dimensions?: { width?: number; height?: number }
) {
  await db.update(users)
    .set({
      profileImage: imageUrl,
      profileImageAlt: altText,
      ...dimensions,
    })
    .where(eq(users.id, userId));

  revalidatePath('/profile');
  return { success: true };
}
```

## That's All!

You now have a fully functional upload system with:
- Multiple provider support
- Automatic old file cleanup
- Validation
- Preview
- Progress tracking

## Quick Tips

### Tip 1: Different Folders for Different Content

```tsx
// Country images
<ImageUploadV2 folder="country-banners" ... />

// Visa images
<ImageUploadV2 folder="visa-cards" ... />

// User documents
<ImageUploadV2 folder="documents" ... />
```

### Tip 2: Custom Aspect Ratios

```tsx
// Portrait (3:4)
<ImageUploadV2 aspectRatio="3/4" ... />

// Landscape (16:9)
<ImageUploadV2 aspectRatio="16/9" ... />

// Square (1:1)
<ImageUploadV2 aspectRatio="1/1" ... />
```

### Tip 3: Different Size Limits

```tsx
// Small images (profile pics)
<ImageUploadV2 maxSizeMB={2} ... />

// Large images (banners)
<ImageUploadV2 maxSizeMB={10} ... />
```

## Advanced: Server-Side Upload

If you need more control, use server actions directly:

```typescript
import { replaceFileByUrl } from '@/lib/upload/server-actions';

// In your server action
export async function uploadBanner(formData: FormData, oldUrl?: string) {
  const file = formData.get('file') as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload new file, delete old automatically
  const result = await replaceFileByUrl(
    {
      buffer: Array.from(buffer) as any,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    },
    {
      folder: 'country-banners',
      maxSizeMB: 5,
    },
    oldUrl  // Will be deleted automatically
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.result.url;
}
```

## Switching Providers

Just change the environment variable:

```bash
# Local (development)
UPLOAD_PROVIDER=local

# S3 (production)
UPLOAD_PROVIDER=s3

# Cloudinary (if you prefer)
UPLOAD_PROVIDER=cloudinary
```

**No code changes needed!** 🎉

## What Gets Deleted Automatically?

When you use `ImageUploadV2` or `replaceFileByUrl()`:

1. **Upload new file first** (if this fails, old file is preserved)
2. **Delete old file** (only if upload succeeded)
3. **Return new URL**

This ensures you never lose data due to upload failures.

## Testing Locally

1. Set `UPLOAD_PROVIDER=local` in `.env`
2. Images save to: `public/uploads/`
3. URLs look like: `/uploads/country-banners/12345-image.jpg`
4. View in browser: `http://localhost:3000/uploads/...`

## Deploying to Production

### Option 1: Local with CDN (Good for small sites)

```env
UPLOAD_PROVIDER=local
```

Serve `public/uploads/` via:
- Vercel (automatic)
- Cloudflare Pages (automatic)
- Your CDN

### Option 2: AWS S3 (Recommended for scale)

```env
UPLOAD_PROVIDER=s3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET_NAME=my-bucket
```

Don't forget:
- Make bucket public or use CloudFront
- Set CORS policy for uploads
- Enable versioning for backup

### Option 3: Cloudinary (Best for image-heavy)

```bash
npm install cloudinary
```

```env
UPLOAD_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Bonus: Automatic image transformations!

## Troubleshooting

### "UPLOAD_PROVIDER not set"
Add to `.env`: `UPLOAD_PROVIDER=local`

### "Failed to upload"
Check:
1. File size within limit?
2. File type allowed?
3. Provider credentials correct?
4. Network connection?

### Old images not deleting
You're probably using `uploadFile()` instead of `replaceFileByUrl()`.
Use the **replace** methods for automatic deletion!

### Images not showing
- Local: Check `public/uploads/` exists
- S3: Check bucket is public or CloudFront configured
- Cloudinary: Check API credentials

## Next Steps

- [Full Documentation](./README.md)
- [Provider Details](./README.md#provider-comparison)
- [Security Best Practices](./README.md#security)
- [Migration Guide](./README.md#migration-guide)

## Need Help?

1. Check the [full README](./README.md)
2. Look at example components in `/components/admin/config/`
3. Review server actions in `./server-actions.ts`

---

**You're all set!** Start uploading with automatic cleanup in minutes. 🚀
