/** URL slug pattern for blog posts: lowercase words separated by hyphens. */
export const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBlogSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function slugifyFromTitle(title: string): string {
  return normalizeBlogSlug(title);
}
