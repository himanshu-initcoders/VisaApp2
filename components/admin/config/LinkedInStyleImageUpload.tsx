'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';
import { replaceFileByUrl } from '@/lib/upload/server-actions';
import type { UploadFolder } from '@/lib/upload';

interface LinkedInStyleImageUploadProps {
  type: 'banner' | 'profile' | 'flag';
  currentImageUrl?: string | null;
  onSuccess: (imageUrl: string) => void;
  folder: UploadFolder;
  aspectRatio?: string;
  maxSizeMB?: number;
}

export function LinkedInStyleImageUpload({
  type,
  currentImageUrl,
  onSuccess,
  folder,
  aspectRatio,
  maxSizeMB = 5,
}: LinkedInStyleImageUploadProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploading(true);

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Array.from(new Uint8Array(arrayBuffer));

      // Upload and replace old image
      const result = await replaceFileByUrl(
        {
          buffer: buffer as any,
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        },
        {
          folder,
          maxSizeMB,
          allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
        },
        currentImageUrl // Old image will be deleted
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update preview and call success callback
      setPreviewUrl(result.result.url);
      onSuccess(result.result.url);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // Banner style (wide, like LinkedIn cover)
  if (type === 'banner') {
    return (
      <div
        className="relative w-full h-48 bg-gradient-to-r from-sky-wash to-mint-wash rounded-3xl overflow-hidden cursor-pointer group"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleClick}
        style={aspectRatio ? { aspectRatio } : {}}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Upload className="h-8 w-8 text-slate-helper mx-auto mb-2" />
              <p className="text-sm text-slate-helper">Click to upload banner</p>
            </div>
          </div>
        )}

        {/* Hover overlay */}
        {(isHovering || isUploading) && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity">
            {isUploading ? (
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Uploading...</p>
              </div>
            ) : (
              <div className="text-white text-center">
                <Camera className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm font-medium">
                  {previewUrl ? 'Change banner' : 'Add banner'}
                </p>
              </div>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // Profile/Flag style (circular or square, like LinkedIn profile pic)
  if (type === 'profile' || type === 'flag') {
    const size = type === 'profile' ? 'w-32 h-32' : 'w-24 h-24';
    const borderRadius = type === 'profile' ? 'rounded-full' : 'rounded-2xl';

    return (
      <div
        className={`relative ${size} bg-white border-4 border-white shadow-lg overflow-hidden cursor-pointer group`}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleClick}
      >
        <div className={`w-full h-full ${borderRadius} overflow-hidden bg-fog-edge`}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={type === 'profile' ? 'Profile' : 'Flag'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Upload className="h-8 w-8 text-slate-helper" />
            </div>
          )}
        </div>

        {/* Hover overlay */}
        {(isHovering || isUploading) && (
          <div className={`absolute inset-0 ${borderRadius} bg-black/60 flex items-center justify-center`}>
            {isUploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  return null;
}
