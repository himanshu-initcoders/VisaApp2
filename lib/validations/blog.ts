import { z } from 'zod';
import { BLOG_SLUG_PATTERN, normalizeBlogSlug } from '@/lib/blog/slug';

/** Absolute URL or local upload path (/uploads/...). */
const optionalImageSrc = z
  .union([
    z.string().url('Must be a valid URL'),
    z
      .string()
      .regex(/^\/[^\s]+$/, 'Must be a valid path or URL'),
    z.literal(''),
  ])
  .nullable()
  .optional();

const blogSeoSchema = z.object({
  metaTitle: z
    .union([
      z.string().min(10, 'Meta title must be at least 10 characters').max(100),
      z.literal(''),
    ])
    .nullable()
    .optional(),
  metaDescription: z
    .union([
      z
        .string()
        .min(20, 'Meta description must be at least 20 characters')
        .max(200),
      z.literal(''),
    ])
    .nullable()
    .optional(),
  ogImageUrl: optionalImageSrc,
});

export const blogPostFormSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title too long'),
  slug: z
    .string()
    .trim()
    .min(3, 'URL slug must be at least 3 characters')
    .max(120, 'URL slug is too long')
    .transform((value) => normalizeBlogSlug(value))
    .refine((value) => BLOG_SLUG_PATTERN.test(value), {
      message: 'Use lowercase words separated by hyphens, like visa-tips',
    }),
  excerpt: z
    .union([z.string().max(500, 'Excerpt too long'), z.literal('')])
    .nullable()
    .optional(),
  body: z.string().min(1, 'Body content is required'),
  coverImageUrl: optionalImageSrc,
  coverImageKey: z.union([z.string(), z.literal('')]).nullable().optional(),
  coverImageAlt: z
    .union([z.string().max(255, 'Alt text too long'), z.literal('')])
    .nullable()
    .optional(),
  seo: blogSeoSchema.optional(),
  status: z.enum(['draft', 'published']),
});

export type BlogPostFormInput = z.infer<typeof blogPostFormSchema>;
export type BlogPostFormValues = z.input<typeof blogPostFormSchema>;

export const createBlogPostSchema = blogPostFormSchema;
export const updateBlogPostSchema = blogPostFormSchema;
