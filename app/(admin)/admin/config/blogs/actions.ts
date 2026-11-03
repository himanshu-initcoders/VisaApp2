'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema-extended';
import { requireRole } from '@/lib/auth-utils';
import { sanitizeBlogHtml } from '@/lib/blog/sanitize';
import { revalidateBlog } from '@/lib/revalidate-blog';
import {
  blogPostFormSchema,
  type BlogPostFormInput,
} from '@/lib/validations/blog';
import { uploadService } from '@/lib/upload';

function normalizeSeo(seo: BlogPostFormInput['seo']) {
  if (!seo) return null;
  const metaTitle = seo.metaTitle?.trim() || undefined;
  const metaDescription = seo.metaDescription?.trim() || undefined;
  const ogImageUrl = seo.ogImageUrl?.trim() || undefined;
  if (!metaTitle && !metaDescription && !ogImageUrl) return null;
  return { metaTitle, metaDescription, ogImageUrl };
}

function toDbValues(
  validated: BlogPostFormInput,
  authorUserId: string | undefined,
  existingPublishedAt: Date | null | undefined
) {
  const now = new Date();
  const publishing = validated.status === 'published';
  return {
    title: validated.title.trim(),
    slug: validated.slug,
    excerpt: validated.excerpt?.trim() || null,
    body: sanitizeBlogHtml(validated.body),
    coverImageUrl: validated.coverImageUrl?.trim() || null,
    coverImageKey: validated.coverImageKey?.trim() || null,
    coverImageAlt: validated.coverImageAlt?.trim() || null,
    seo: normalizeSeo(validated.seo),
    status: validated.status,
    publishedAt: publishing
      ? existingPublishedAt ?? now
      : existingPublishedAt ?? null,
    authorUserId: authorUserId ?? null,
    updatedAt: now,
  };
}

export async function createBlogPost(data: unknown) {
  const session = await requireRole(['admin']);

  try {
    const validated = blogPostFormSchema.parse(data);

    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.slug, validated.slug),
      columns: { id: true },
    });
    if (existing) {
      return { error: `A post with slug "${validated.slug}" already exists` };
    }

    const [created] = await db
      .insert(blogPosts)
      .values(toDbValues(validated, session.user.id, null))
      .returning({ id: blogPosts.id, slug: blogPosts.slug });

    revalidatePath('/admin/config/blogs');
    revalidateBlog({ slug: created.slug });

    return {
      success: true,
      id: created.id,
      message: 'Blog post created successfully',
    };
  } catch (error) {
    console.error('Error creating blog post:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid blog post data provided' };
    }
    return { error: 'Failed to create blog post' };
  }
}

export async function updateBlogPost(id: string, data: unknown) {
  const session = await requireRole(['admin']);

  try {
    const validated = blogPostFormSchema.parse(data);

    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
    });
    if (!existing) {
      return { error: 'Blog post not found' };
    }

    const slugOwner = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.slug, validated.slug),
      columns: { id: true },
    });
    if (slugOwner && slugOwner.id !== id) {
      return { error: `A post with slug "${validated.slug}" already exists` };
    }

    await db
      .update(blogPosts)
      .set(
        toDbValues(
          validated,
          existing.authorUserId ?? session.user.id,
          existing.publishedAt
        )
      )
      .where(eq(blogPosts.id, id));

    revalidatePath('/admin/config/blogs');
    revalidatePath(`/admin/config/blogs/${id}`);
    revalidateBlog({
      slug: validated.slug,
      previousSlug: existing.slug,
    });

    return { success: true, message: 'Blog post updated successfully' };
  } catch (error) {
    console.error('Error updating blog post:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return { error: 'Invalid blog post data provided' };
    }
    return { error: 'Failed to update blog post' };
  }
}

export async function deleteBlogPost(id: string) {
  await requireRole(['admin']);

  try {
    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
      columns: { id: true, slug: true },
    });
    if (!existing) {
      return { error: 'Blog post not found' };
    }

    await db.delete(blogPosts).where(eq(blogPosts.id, id));

    revalidatePath('/admin/config/blogs');
    revalidateBlog({ slug: existing.slug });

    return { success: true, message: 'Blog post deleted successfully' };
  } catch (error) {
    console.error('Error deleting blog post:', error);
    return { error: 'Failed to delete blog post' };
  }
}

/** TinyMCE inline image upload → returns public URL. */
export async function uploadBlogInlineImage(formData: FormData) {
  await requireRole(['admin']);

  try {
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return { error: 'No file provided' };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadService.upload(buffer, {
      folder: 'blog-inline',
      maxSizeMB: 3,
      allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      filename: file.name || 'inline.jpg',
    });

    return { success: true as const, url: result.url };
  } catch (error) {
    console.error('Error uploading blog inline image:', error);
    return { error: 'Failed to upload image' };
  }
}
