'use client';

import { useState } from 'react';
import { Maximize2, Edit, Image as ImageIcon } from 'lucide-react';
import { LinkedInStyleImageUpload } from './LinkedInStyleImageUpload';

interface CountryImages {
  banner?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  hero?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  flag?: {
    url: string;
  };
}

interface ImageGalleryProps {
  images?: CountryImages | null;
  onImageUpdate: (type: 'banner' | 'hero' | 'flag', url: string) => Promise<void>;
}

export function ImageGallery({ images, onImageUpdate }: ImageGalleryProps) {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [editingImage, setEditingImage] = useState<'banner' | 'hero' | 'flag' | null>(null);

  const imageItems = [
    {
      type: 'hero' as const,
      title: 'Banner Image',
      description: 'Wide landscape image shown at the top of this country card (21:9 ratio)',
      url: images?.hero?.url,
      folder: 'country-heroes' as const,
      aspectRatio: '21/9',
      maxSize: 5,
    },
    {
      type: 'banner' as const,
      title: 'Card Image',
      description: 'Portrait image used on destination and listing cards (3:4 ratio)',
      url: images?.banner?.url,
      folder: 'country-banners' as const,
      aspectRatio: '3/4',
      maxSize: 5,
    },
    {
      type: 'flag' as const,
      title: 'Flag Logo',
      description: 'Square flag icon (1:1 ratio)',
      url: images?.flag?.url,
      folder: 'country-flags' as const,
      aspectRatio: '1/1',
      maxSize: 1,
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <p className="text-sm text-slate-helper">
          Click to view fullscreen, or edit to change any image. Old images are automatically deleted.
        </p>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {imageItems.map((item) => (
            <div
              key={item.type}
              className="bg-white border border-ash-divider rounded-2xl overflow-hidden hover:shadow-card transition-shadow"
            >
              {/* Image Preview */}
              <div className="relative bg-fog-edge aspect-video group">
                {item.url ? (
                  <>
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setFullscreenImage(item.url!)}
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => setFullscreenImage(item.url!)}
                        className="p-3 bg-white rounded-full hover:bg-sky-wash transition-colors"
                        title="View fullscreen"
                      >
                        <Maximize2 className="h-5 w-5 text-portrait-ink" />
                      </button>
                      <button
                        onClick={() => setEditingImage(item.type)}
                        className="p-3 bg-white rounded-full hover:bg-mint-wash transition-colors"
                        title="Change image"
                      >
                        <Edit className="h-5 w-5 text-portrait-ink" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div
                    className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-sky-wash/30 transition-colors"
                    onClick={() => setEditingImage(item.type)}
                  >
                    <ImageIcon className="h-12 w-12 text-slate-helper mb-2" />
                    <p className="text-sm text-slate-helper">Click to upload</p>
                  </div>
                )}
              </div>

              {/* Image Info */}
              <div className="p-4">
                <h3 className="text-sm font-medium text-portrait-ink mb-1">{item.title}</h3>
                <p className="text-xs text-slate-helper">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="bg-sky-wash/30 rounded-2xl p-4">
          <p className="text-xs text-slate-helper">
            <strong>Tip:</strong> Banner image appears at the top of this card. Card image and flag are used on listing and destination cards.
          </p>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-slate-helper transition-colors text-4xl"
            onClick={() => setFullscreenImage(null)}
          >
            ×
          </button>
          <img
            src={fullscreenImage}
            alt="Fullscreen view"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Edit Modal */}
      {editingImage && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                className="text-[31px] font-medium text-portrait-ink"
                style={{ fontFamily: 'Basier Circle', letterSpacing: '-0.4px' }}
              >
                Change {editingImage === 'hero' ? 'Banner' : editingImage === 'banner' ? 'Card' : 'Flag'} Image
              </h3>
              <button
                onClick={() => setEditingImage(null)}
                className="text-slate-helper hover:text-portrait-ink text-3xl"
              >
                ×
              </button>
            </div>

            <LinkedInStyleImageUpload
              type="banner"
              currentImageUrl={
                editingImage === 'hero'
                  ? images?.hero?.url
                  : editingImage === 'banner'
                  ? images?.banner?.url
                  : images?.flag?.url
              }
              onSuccess={async (url) => {
                await onImageUpdate(editingImage, url);
                setEditingImage(null);
              }}
              folder={
                editingImage === 'hero'
                  ? 'country-heroes'
                  : editingImage === 'banner'
                  ? 'country-banners'
                  : 'country-flags'
              }
              aspectRatio={
                editingImage === 'hero' ? '21/9' : editingImage === 'banner' ? '3/4' : '1/1'
              }
              maxSizeMB={editingImage === 'flag' ? 1 : 5}
            />

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setEditingImage(null)}
                className="px-4 py-2 text-sm text-slate-helper hover:text-portrait-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
