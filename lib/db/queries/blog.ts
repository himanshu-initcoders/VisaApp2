import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts, type BlogPost } from '@/lib/db/schema-extended';

export type { BlogPost };

function isMissingRelationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as {
    code?: string;
    message?: string;
    cause?: { code?: string; message?: string };
  };
  const code = maybe.code ?? maybe.cause?.code;
  const message = `${maybe.message ?? ''} ${maybe.cause?.message ?? ''}`;
  return code === '42P01' || /relation ["']?blog_posts["']? does not exist/i.test(message);
}

/** All posts for admin list (newest first). */
export async function getAllBlogPosts(): Promise<BlogPost[]> {
  try {
    return await db.query.blogPosts.findMany({
      orderBy: [desc(blogPosts.updatedAt)],
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn('blog_posts table missing — run npm run db:migrate');
      return [];
    }
    throw error;
  }
}

export async function getBlogPostById(id: string): Promise<BlogPost | undefined> {
  try {
    return await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, id),
    });
  } catch (error) {
    if (isMissingRelationError(error)) return undefined;
    throw error;
  }
}

export async function getBlogPostBySlug(
  slug: string
): Promise<BlogPost | undefined> {
  try {
    return await db.query.blogPosts.findFirst({
      where: eq(blogPosts.slug, slug),
    });
  } catch (error) {
    if (isMissingRelationError(error)) return undefined;
    throw error;
  }
}

/** Published posts for public index and sitemap. */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  try {
    return await db.query.blogPosts.findMany({
      where: eq(blogPosts.status, 'published'),
      orderBy: [desc(blogPosts.publishedAt), desc(blogPosts.updatedAt)],
    });
  } catch (error) {
    // Build/SSR must not fail if migrate has not run on this database yet.
    if (isMissingRelationError(error)) {
      console.warn('blog_posts table missing — run npm run db:migrate');
      return [];
    }
    throw error;
  }
}

/** Newest published posts for homepage / hub teasers. */
export async function getRecentPublishedPosts(
  limit = 3
): Promise<BlogPost[]> {
  try {
    return await db.query.blogPosts.findMany({
      where: eq(blogPosts.status, 'published'),
      orderBy: [desc(blogPosts.publishedAt), desc(blogPosts.updatedAt)],
      limit,
    });
  } catch (error) {
    if (isMissingRelationError(error)) {
      console.warn('blog_posts table missing — run npm run db:migrate');
      return [];
    }
    throw error;
  }
}

export async function getPublishedPostBySlug(
  slug: string
): Promise<BlogPost | undefined> {
  try {
    return await db.query.blogPosts.findFirst({
      where: and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')),
    });
  } catch (error) {
    if (isMissingRelationError(error)) return undefined;
    throw error;
  }
}

export async function getPublishedPostSlugs(): Promise<string[]> {
  try {
    const rows = await db.query.blogPosts.findMany({
      where: eq(blogPosts.status, 'published'),
      columns: { slug: true },
    });
    return rows.map((row) => row.slug);
  } catch (error) {
    if (isMissingRelationError(error)) return [];
    throw error;
  }
}
