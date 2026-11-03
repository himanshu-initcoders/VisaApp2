import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth-utils';
import { getBlogPostById } from '@/lib/db/queries/blog';
import { BlogPostForm } from '@/components/admin/config/BlogPostForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({ params }: PageProps) {
  await requireRole(['admin']);
  const { id } = await params;
  const post = await getBlogPostById(id);
  if (!post) notFound();

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Link
              href="/admin/config/blogs"
              className="text-nautical-teal hover:underline"
            >
              Blogs
            </Link>
            <span className="text-slate-helper">/</span>
            <span className="text-portrait-ink">{post.title}</span>
          </div>
          <h1
            className="mb-2 text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
          >
            Edit post
          </h1>
          <p className="text-base text-slate-helper">
            Update content, SEO, and publish status.
            {post.status === 'published' ? (
              <>
                {' '}
                <Link
                  href={`/blogs/${post.slug}`}
                  className="text-nautical-teal hover:underline"
                  target="_blank"
                >
                  View live page
                </Link>
              </>
            ) : null}
          </p>
        </div>

        <BlogPostForm post={post} />
      </div>
    </div>
  );
}
