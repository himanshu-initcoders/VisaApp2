import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts, type BlogPost } from '@/lib/db/schema-extended';

export type { BlogPost };

/** All posts for admin list (newest first). */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  return db.query.blogPosts.findMany({
    orderBy: [desc(blogPosts.updatedAt)],
  });
}

export async function getBlogPostById(id: string): Promise<BlogPost | undefined> {
  return db.query.blogPosts.findFirst({
    where: eq(blogPosts.id, id),
  });
}

export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPost | undefined> {
  return db.query.blogPosts.findFirst({
    where: eq(blogPosts.slug, slug),
  });
}

/** Published posts for public index and sitemap. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  return db.query.blogPosts.findMany({
    where: eq(blogPosts.status, 'published'),
    orderBy: [desc(blogPosts.publishedAt), desc(blogPosts.updatedAt)],
  });
}

export async function getPublishedPostBySlug(
  slug: string
): Promise<BlogPost | undefined> {
  return db.query.blogPosts.findFirst({
    where: and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')),
  });
}

export async function getPublishedPostSlugs(): Promise<string[]> {
  const rows = await db.query.blogPosts.findMany({
    where: eq(blogPosts.status, 'published'),
    columns: { slug: true },
  });
  return rows.map((row) => row.slug);
}
