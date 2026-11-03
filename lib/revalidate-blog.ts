import { revalidatePath } from 'next/cache';

/** Invalidate public blog index and optional post after admin publish/edit. */
export function revalidateBlog(options?: { slug?: string; previousSlug?: string }) {
  revalidatePath('/blogs');
  revalidatePath('/blogs/[slug]', 'page');
  revalidatePath('/sitemap.xml');

  if (options?.slug) {
    revalidatePath(`/blogs/${options.slug}`);
  }
  if (options?.previousSlug && options.previousSlug !== options.slug) {
    revalidatePath(`/blogs/${options.previousSlug}`);
  }
}
