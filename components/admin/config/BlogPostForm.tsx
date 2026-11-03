'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import {
  blogPostFormSchema,
  type BlogPostFormValues,
} from '@/lib/validations/blog';
import { slugifyFromTitle } from '@/lib/blog/slug';
import {
  createBlogPost,
  updateBlogPost,
} from '@/app/(admin)/admin/config/blogs/actions';
import { replaceFileByUrlFromFormData } from '@/lib/upload/server-actions';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { BlogPost } from '@/lib/db/schema-extended';

const TinyMceEditor = dynamic(
  () =>
    import('@/components/admin/config/TinyMceEditor').then(
      (mod) => mod.TinyMceEditor
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] animate-pulse rounded-2xl border border-ash-divider bg-sky-wash/40" />
    ),
  }
);

interface BlogPostFormProps {
  post?: BlogPost;
}

export function BlogPostForm({ post }: BlogPostFormProps) {
  const router = useRouter();
  const isEdit = Boolean(post);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [slugTouched, setSlugTouched] = useState(Boolean(post?.slug));
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [localCoverPreview, setLocalCoverPreview] = useState<string | null>(
    null
  );
  const hasTinymceKey = Boolean(process.env.NEXT_PUBLIC_TINYMCE_API_KEY);

  const defaultValues = useMemo<BlogPostFormValues>(
    () => ({
      title: post?.title ?? '',
      slug: post?.slug ?? '',
      excerpt: post?.excerpt ?? '',
      body: post?.body ?? '',
      coverImageUrl: post?.coverImageUrl ?? '',
      coverImageKey: post?.coverImageKey ?? '',
      coverImageAlt: post?.coverImageAlt ?? '',
      seo: {
        metaTitle: post?.seo?.metaTitle ?? '',
        metaDescription: post?.seo?.metaDescription ?? '',
        ogImageUrl: post?.seo?.ogImageUrl ?? '',
      },
      status: (post?.status as 'draft' | 'published') ?? 'draft',
    }),
    [post]
  );

  const form = useForm<BlogPostFormValues>({
    resolver: zodResolver(blogPostFormSchema),
    defaultValues,
  });

  const coverImageUrl = form.watch('coverImageUrl');
  const coverImageAlt = form.watch('coverImageAlt');
  const bodyValue = form.watch('body');
  const coverPreview = localCoverPreview || coverImageUrl || null;

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size / (1024 * 1024) > 5) {
      setFormError('Cover image must be 5MB or smaller');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setFormError('Cover must be a JPG, PNG, or WebP image');
      return;
    }

    setFormError(null);
    setPendingCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setLocalCoverPreview(typeof reader.result === 'string' ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const clearCover = () => {
    setPendingCoverFile(null);
    setLocalCoverPreview(null);
    form.setValue('coverImageUrl', '', { shouldDirty: true });
    form.setValue('coverImageKey', '', { shouldDirty: true });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onSubmit = async (data: BlogPostFormValues) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      let payload = { ...data };

      if (pendingCoverFile) {
        const formData = new FormData();
        formData.append('file', pendingCoverFile);
        formData.append('folder', 'blog-covers');
        formData.append('maxSizeMB', '5');
        if (data.coverImageUrl) {
          formData.append('oldUrl', data.coverImageUrl);
        }

        const upload = await replaceFileByUrlFromFormData(formData);
        if (!upload.success) {
          setFormError(upload.error || 'Failed to upload cover image');
          return;
        }

        payload = {
          ...payload,
          coverImageUrl: upload.result.url,
          coverImageKey: upload.result.key,
          coverImageAlt: payload.coverImageAlt || pendingCoverFile.name,
        };
      }

      const result = isEdit
        ? await updateBlogPost(post!.id, payload)
        : await createBlogPost(payload);

      if (!result.success) {
        setFormError(result.error || 'Failed to save blog post');
        return;
      }

      setPendingCoverFile(null);
      setLocalCoverPreview(null);

      if (!isEdit && 'id' in result && result.id) {
        router.push(`/admin/config/blogs/${result.id}`);
      } else {
        router.push('/admin/config/blogs');
      }
      router.refresh();
    } catch (error) {
      console.error('Error saving blog post:', error);
      setFormError('Failed to save blog post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-3xl border border-ash-divider bg-white p-8">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <section className="space-y-6">
          <div>
            <h2
              className="mb-2 text-xl font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Post details
            </h2>
            <p className="text-sm text-slate-helper">
              Title, URL slug, and short excerpt for the blog listing.
            </p>
          </div>

          <Input
            label="Title"
            placeholder="How to renew your passport online"
            error={form.formState.errors.title?.message}
            {...form.register('title', {
              onChange: (e) => {
                if (!slugTouched) {
                  form.setValue('slug', slugifyFromTitle(e.target.value), {
                    shouldValidate: true,
                  });
                }
              },
            })}
          />

          <Input
            label="URL slug"
            placeholder="how-to-renew-passport"
            helperText="Public URL: /blogs/your-slug"
            error={form.formState.errors.slug?.message}
            {...form.register('slug', {
              onChange: () => setSlugTouched(true),
            })}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
              Excerpt
            </label>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-ash-divider px-4 py-3 text-sm text-portrait-ink placeholder:text-slate-helper focus:border-nautical-teal focus:outline-none focus:ring-2 focus:ring-nautical-teal/20"
              placeholder="One or two sentences shown on the blog index."
              {...form.register('excerpt')}
            />
            {form.formState.errors.excerpt?.message && (
              <p className="mt-1 text-sm text-red-600">
                {form.formState.errors.excerpt.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
              Status
            </label>
            <select
              className="w-full rounded-2xl border border-ash-divider px-4 py-3 text-sm text-portrait-ink focus:border-nautical-teal focus:outline-none focus:ring-2 focus:ring-nautical-teal/20"
              {...form.register('status')}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </section>

        <section className="space-y-6 border-t border-ash-divider pt-8">
          <div>
            <h2
              className="mb-2 text-xl font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Cover image
            </h2>
            <p className="text-sm text-slate-helper">
              Choose an image now — it uploads when you click Save changes.
              Recommended 1200×630.
            </p>
          </div>

          <div className="rounded-3xl border-2 border-dashed border-ash-divider bg-white p-6">
            {coverPreview ? (
              <div className="relative flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverPreview}
                  alt={coverImageAlt || 'Cover preview'}
                  className="max-h-64 max-w-full rounded-2xl object-contain"
                />
                <button
                  type="button"
                  onClick={clearCover}
                  className="absolute right-2 top-2 rounded-full bg-white p-2 shadow-card hover:bg-red-50"
                  aria-label="Remove cover image"
                >
                  <X className="h-4 w-4 text-red-600" />
                </button>
                {pendingCoverFile ? (
                  <p className="mt-3 text-xs text-slate-helper">
                    Selected: {pendingCoverFile.name} — will upload on save
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-wash">
                  <ImageIcon className="h-8 w-8 text-portrait-ink" />
                </div>
                <p className="mb-2 text-sm font-medium text-portrait-ink">
                  Select a cover image
                </p>
                <p className="mb-4 text-xs text-slate-helper">
                  Max 5MB · JPG, PNG, WebP
                </p>
              </div>
            )}

            <div className="mt-4 flex justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleCoverSelect}
                className="hidden"
                id="blog-cover-file"
              />
              <label
                htmlFor="blog-cover-file"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-ash-divider bg-white px-4 py-2 text-sm font-medium text-portrait-ink transition-colors hover:bg-sky-wash"
              >
                <Upload className="h-4 w-4 shrink-0" />
                {coverPreview ? 'Change image' : 'Select image'}
              </label>
            </div>
          </div>

          <Input
            label="Cover alt text"
            placeholder="Describe the cover for accessibility"
            error={form.formState.errors.coverImageAlt?.message}
            {...form.register('coverImageAlt')}
          />
        </section>

        <section className="space-y-6 border-t border-ash-divider pt-8">
          <div>
            <h2
              className="mb-2 text-xl font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Body
            </h2>
            <p className="text-sm text-slate-helper">
              Write in the visual editor, or click the Code toolbar button to
              paste raw HTML. Do not paste HTML tags into the visual pane —
              they will show as plain text on the public page.
            </p>
          </div>

          <Controller
            control={form.control}
            name="body"
            render={({ field }) =>
              hasTinymceKey ? (
                <TinyMceEditor value={field.value} onChange={field.onChange} />
              ) : (
                <textarea
                  rows={16}
                  className="w-full rounded-2xl border border-ash-divider px-4 py-3 font-mono text-sm text-portrait-ink focus:border-nautical-teal focus:outline-none focus:ring-2 focus:ring-nautical-teal/20"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="<p>Article HTML…</p>"
                />
              )
            }
          />
          {form.formState.errors.body?.message && (
            <p className="text-sm text-red-600">
              {form.formState.errors.body.message}
            </p>
          )}
          {!hasTinymceKey && bodyValue ? (
            <p className="text-xs text-slate-helper">
              TinyMCE key missing — editing as HTML.
            </p>
          ) : null}
        </section>

        <section className="space-y-6 border-t border-ash-divider pt-8">
          <div>
            <h2
              className="mb-2 text-xl font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              SEO
            </h2>
            <p className="text-sm text-slate-helper">
              Optional overrides for search and social. Leave blank to use the
              post title and excerpt.
            </p>
          </div>

          <Input
            label="Meta title"
            placeholder="Custom title for search results"
            error={form.formState.errors.seo?.metaTitle?.message}
            {...form.register('seo.metaTitle')}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-portrait-ink">
              Meta description
            </label>
            <textarea
              rows={3}
              className="w-full rounded-2xl border border-ash-divider px-4 py-3 text-sm text-portrait-ink focus:border-nautical-teal focus:outline-none focus:ring-2 focus:ring-nautical-teal/20"
              {...form.register('seo.metaDescription')}
            />
            {form.formState.errors.seo?.metaDescription?.message && (
              <p className="mt-1 text-sm text-red-600">
                {form.formState.errors.seo.metaDescription.message}
              </p>
            )}
          </div>
          <Input
            label="Open Graph image URL"
            placeholder="https://… (defaults to cover image)"
            error={form.formState.errors.seo?.ogImageUrl?.message}
            {...form.register('seo.ogImageUrl')}
          />
        </section>

        {formError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        <div className="flex items-center gap-3 border-t border-ash-divider pt-8">
          <Button type="submit" variant="primary" size="md" disabled={isSubmitting}>
            {isSubmitting
              ? pendingCoverFile
                ? 'Uploading cover & saving…'
                : 'Saving…'
              : isEdit
                ? 'Save changes'
                : 'Create post'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => router.push('/admin/config/blogs')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
