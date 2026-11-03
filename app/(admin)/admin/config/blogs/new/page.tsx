import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { BlogPostForm } from '@/components/admin/config/BlogPostForm';

export default async function NewBlogPostPage() {
  await requireRole(['admin']);

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
            <span className="text-portrait-ink">New post</span>
          </div>
          <h1
            className="mb-2 text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
            style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
          >
            New blog post
          </h1>
          <p className="text-base text-slate-helper">
            Draft privately, then publish when SEO and content are ready.
          </p>
        </div>

        <BlogPostForm />
      </div>
    </div>
  );
}
