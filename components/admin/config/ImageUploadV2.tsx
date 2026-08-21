'use client';

import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Check } from 'lucide-react';
import { replaceFileByUrl } from '@/lib/upload/server-actions';
import type { UploadFolder } from '@/lib/upload';

interface ImageUploadV2Props {
  label: string;
  description?: string;
  currentImageUrl?: string | null;
  altText?: string;
  dimensions?: { width?: number | null; height?: number | null };
  onSuccess: (imageUrl: string, altText: string, dimensions?: { width?: number; height?: number }) => void;
  folder: UploadFolder;
  aspectRatio?: string;
  maxSizeMB?: number;
}

export function ImageUploadV2({
  label,
  description,
  currentImageUrl,
  altText: initialAltText = '',
  dimensions: initialDimensions,
  onSuccess,
  folder,
  aspectRatio,
  maxSizeMB = 5,
}: ImageUploadV2Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [altText, setAltText] = useState(initialAltText);
  const [dimensions, setDimensions] = useState<{ width?: number; height?: number }>({
    width: initialDimensions?.width ?? undefined,
    height: initialDimensions?.height ?? undefined,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      alert(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setSelectedFile(file);
    setUploadComplete(false);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Convert file to buffer for server action
      const arrayBuffer = await selectedFile.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));

      // Upload file (automatically deletes old one if currentImageUrl exists)
      const result = await replaceFileByUrl(
        {
          buffer: buffer as any,
          filename: selectedFile.name,
          mimeType: selectedFile.type,
          size: selectedFile.size,
        },
        {
          folder,
          maxSizeMB,
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        },
        currentImageUrl // This will be deleted automatically
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Call success callback with new image URL
      onSuccess(result.result.url, altText, dimensions);

      // Show success state
      setUploadComplete(true);
      setTimeout(() => setUploadComplete(false), 3000);

      // Update preview to show uploaded image
      setPreviewUrl(result.result.url);
      setSelectedFile(null);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClear = () => {
    setPreviewUrl(currentImageUrl || null);
    setSelectedFile(null);
    setAltText(initialAltText);
    setDimensions({
      width: initialDimensions?.width ?? undefined,
      height: initialDimensions?.height ?? undefined,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      {/* Label & Description */}
      <div>
        <label className="block text-sm font-medium text-portrait-ink mb-1">
          {label}
        </label>
        {description && (
          <p className="text-xs text-slate-helper">{description}</p>
        )}
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-3xl p-6 transition-colors ${
          previewUrl ? 'border-ash-divider bg-fog-edge/20' : 'border-ash-divider hover:border-portrait-ink/30 bg-white'
        }`}
        style={aspectRatio ? { aspectRatio } : {}}
      >
        {previewUrl ? (
          // Preview
          <div className="relative h-full flex flex-col items-center justify-center">
            <img
              src={previewUrl}
              alt={altText || 'Preview'}
              className="max-h-64 max-w-full object-contain rounded-2xl"
            />
            {selectedFile && (
              <button
                onClick={handleClear}
                className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-card hover:bg-red-50 transition-colors"
                aria-label="Clear selection"
              >
                <X className="h-4 w-4 text-red-600" />
              </button>
            )}
            {uploadComplete && (
              <div className="absolute top-2 left-2 px-3 py-2 bg-green-500 text-white rounded-full shadow-card flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Uploaded!</span>
              </div>
            )}
          </div>
        ) : (
          // Upload prompt
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-sky-wash flex items-center justify-center mb-4">
              <ImageIcon className="h-8 w-8 text-portrait-ink" />
            </div>
            <p className="text-sm font-medium text-portrait-ink mb-2">
              Drop your image here or click to browse
            </p>
            <p className="text-xs text-slate-helper mb-4">
              {aspectRatio ? `${aspectRatio} aspect ratio • ` : ''}
              Max {maxSizeMB}MB • JPG, PNG, WebP
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
              id={`file-${folder}`}
            />
            <label
              htmlFor={`file-${folder}`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-medium bg-white border border-ash-divider text-portrait-ink hover:bg-sky-wash cursor-pointer transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Select Image
            </label>
          </div>
        )}
      </div>

      {/* Alt Text & Dimensions */}
      {(previewUrl || selectedFile) && (
        <div className="space-y-4 p-4 bg-sky-wash/30 rounded-2xl">
          <div>
            <label className="block text-sm font-medium text-portrait-ink mb-2">
              Alt Text
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Describe the image for accessibility"
              className="w-full px-4 py-2 border border-ash-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-portrait-ink mb-2">
                Width (optional)
              </label>
              <input
                type="number"
                value={dimensions.width || ''}
                onChange={(e) => setDimensions({ ...dimensions, width: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 1200"
                className="w-full px-4 py-2 border border-ash-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-portrait-ink mb-2">
                Height (optional)
              </label>
              <input
                type="number"
                value={dimensions.height || ''}
                onChange={(e) => setDimensions({ ...dimensions, height: e.target.value ? parseInt(e.target.value) : undefined })}
                placeholder="e.g., 800"
                className="w-full px-4 py-2 border border-ash-divider rounded-xl focus:outline-none focus:ring-2 focus:ring-portrait-ink/20 transition-shadow"
              />
            </div>
          </div>

          {selectedFile && (
            <button
              onClick={handleUpload}
              disabled={isUploading}
              className="w-full px-6 py-3 rounded-full text-sm font-medium bg-portrait-ink text-white hover:bg-nautical-teal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Upload & Replace'
              )}
            </button>
          )}

          {currentImageUrl && !selectedFile && (
            <p className="text-xs text-slate-helper text-center">
              ℹ️ Uploading a new image will automatically delete the old one
            </p>
          )}
        </div>
      )}
    </div>
  );
}
