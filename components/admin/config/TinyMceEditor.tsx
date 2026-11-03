'use client';

import { Editor } from '@tinymce/tinymce-react';
import { uploadBlogInlineImage } from '@/app/(admin)/admin/config/blogs/actions';

interface TinyMceEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  height?: number;
}

export function TinyMceEditor({
  value,
  onChange,
  disabled = false,
  height = 480,
}: TinyMceEditorProps) {
  const apiKey = process.env.NEXT_PUBLIC_TINYMCE_API_KEY;

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-ash-divider bg-peach-wash/40 p-4 text-sm text-portrait-ink">
        Set <code className="font-mono text-xs">NEXT_PUBLIC_TINYMCE_API_KEY</code>{' '}
        in your environment to enable the rich text editor. Until then, use the
        plain HTML textarea fallback below.
      </div>
    );
  }

  return (
    <Editor
      apiKey={apiKey}
      value={value}
      disabled={disabled}
      onEditorChange={(content) => onChange(content)}
      init={{
        height,
        menubar: false,
        branding: false,
        plugins: [
          'lists',
          'link',
          'image',
          'code',
          'table',
          'autolink',
          'charmap',
          'preview',
          'searchreplace',
          'visualblocks',
          'wordcount',
        ],
        toolbar:
          'undo redo | blocks | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image table | removeformat code',
        content_style:
          'body { font-family: Switzer, system-ui, sans-serif; font-size: 16px; line-height: 1.6; color: #08304c; }',
        images_upload_handler: async (blobInfo: {
          blob: () => Blob;
          filename: () => string;
        }) => {
          const formData = new FormData();
          formData.append(
            'file',
            blobInfo.blob(),
            blobInfo.filename() || 'image.jpg'
          );
          const result = await uploadBlogInlineImage(formData);
          if (!result.success || !result.url) {
            throw new Error(result.error || 'Upload failed');
          }
          return result.url;
        },
        automatic_uploads: true,
        paste_data_images: true,
        // Prefer visual editing. For raw HTML source, use the Code toolbar button
        // instead of pasting tags into the visual pane (that stores &lt;p&gt; as text).
        extended_valid_elements:
          'img[class|src|border|alt|title|width|height|loading],figure,figcaption,small',
      }}
    />
  );
}
