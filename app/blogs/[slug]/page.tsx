import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JsonLd } from '@/components/seo/JsonLd';
import { BlogPostViewTracker } from '@/components/analytics/BlogPostViewTracker';
import { sanitizeBlogHtml } from '@/lib/blog/sanitize';
import {
  getPublishedPostBySlug,
  getPublishedPostSlugs,
} from '@/lib/db/queries/blog';
import { absoluteUrl, getSiteUrl } from '@/lib/seo/jsonld';
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const slugs = await getPublishedPostSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return {};

  const title = post.seo?.metaTitle?.trim() || post.title;
  const description =
    post.seo?.metaDescription?.trim() ||
    post.excerpt?.trim() ||
    `Read ${post.title} on the Viserv blog.`;
  const path = `/blogs/${post.slug}`;
  const ogImage =
    post.seo?.ogImageUrl?.trim() || post.coverImageUrl || undefined;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: 'article',
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      modifiedTime: post.updatedAt
        ? new Date(post.updatedAt).toISOString()
        : undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const title = post.seo?.metaTitle?.trim() || post.title;
  const description =
    post.seo?.metaDescription?.trim() ||
    post.excerpt?.trim() ||
    `Read ${post.title} on the Viserv blog.`;
  const path = `/blogs/${post.slug}`;
  const siteUrl = getSiteUrl();
  const safeHtml = sanitizeBlogHtml(post.body);
  const imageUrl =
    post.seo?.ogImageUrl?.trim() || post.coverImageUrl || undefined;

  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            title,
            description,
            path,
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blogs' },
            { name: post.title, path },
          ]),
          buildBlogPostingJsonLd({
            title: post.title,
            description,
            path,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            imageUrl,
            siteUrl,
          }),
        ]}
      />
      <BlogPostViewTracker
        postId={post.id}
        slug={post.slug}
        title={post.title}
      />
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl">
          <div className="mb-8 space-y-4">
            <Link
              href="/blogs"
              className="text-sm text-nautical-teal hover:underline"
            >
              ← All posts
            </Link>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-helper">
              {post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : 'Guide'}
            </p>
            <h1 className="font-basier text-4xl leading-tight text-portrait-ink sm:text-5xl">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="text-lg leading-8 text-slate-helper">{post.excerpt}</p>
            ) : null}
          </div>

          {post.coverImageUrl ? (
            <div className="relative mb-10 aspect-[16/9] w-full overflow-hidden rounded-[24px] bg-sky-wash">
              {/* eslint-disable-next-line @next/next/no-img-element -- CMS covers may be local or arbitrary hosts */}
              <img
                src={
                  toAppMediaUrl(post.coverImageUrl) || post.coverImageUrl
                }
                alt={post.coverImageAlt || post.title}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}

          <div
            className="blog-prose space-y-4 text-base leading-8 text-portrait-ink [&_a]:text-nautical-teal [&_a]:underline [&_h2]:font-basier [&_h2]:text-3xl [&_h2]:mt-10 [&_h2]:mb-4 [&_h3]:font-basier [&_h3]:text-2xl [&_h3]:mt-8 [&_h3]:mb-3 [&_img]:rounded-2xl [&_img]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-nautical-teal/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_figure]:my-8 [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-slate-helper"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />

          <p className="mt-12 text-sm text-slate-helper">
            Share:{' '}
            <a
              className="text-nautical-teal hover:underline"
              href={absoluteUrl(path, siteUrl)}
            >
              {absoluteUrl(path, siteUrl)}
            </a>
          </p>
        </article>
      </main>
      <Footer />
    </>
  );
}
