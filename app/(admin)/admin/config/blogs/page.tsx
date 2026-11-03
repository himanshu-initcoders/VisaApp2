import Link from 'next/link';
import { FileText } from 'lucide-react';
import { requireRole } from '@/lib/auth-utils';
import { getAllBlogPosts } from '@/lib/db/queries/blog';
import { BlogsTable } from '@/components/admin/config/BlogsTable';
import { ConfigEmptyState } from '@/components/admin/config/ConfigEmptyState';
import { Button } from '@/components/ui/Button';

export default async function BlogsConfigPage() {
  await requireRole(['admin']);
  const posts = await getAllBlogPosts();
  const publishedCount = posts.filter((p) => p.status === 'published').length;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1
              className="mb-2 text-[44px] font-medium leading-tight tracking-tight text-portrait-ink"
              style={{ fontFamily: 'Basier Circle', letterSpacing: '-1.15px' }}
            >
              Blogs
            </h1>
            <p className="text-base text-slate-helper">
              Create and publish articles with TinyMCE. Only published posts appear
              on the public blog, sitemap, and search metadata.
            </p>
          </div>
          <Link href="/admin/config/blogs/new">
            <Button variant="primary" size="md">
              New post
            </Button>
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-ash-divider bg-white p-6">
            <p className="mb-1 text-sm text-slate-helper">Total posts</p>
            <p
              className="text-[44px] font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              {posts.length}
            </p>
          </div>
          <div className="rounded-3xl border border-ash-divider bg-white p-6">
            <p className="mb-1 text-sm text-slate-helper">Published</p>
            <p
              className="text-[44px] font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              {publishedCount}
            </p>
          </div>
          <div className="rounded-3xl border border-ash-divider bg-white p-6">
            <p className="mb-1 text-sm text-slate-helper">Drafts</p>
            <p
              className="text-[44px] font-medium text-portrait-ink"
              style={{ fontFamily: 'Basier Circle' }}
            >
              {posts.length - publishedCount}
            </p>
          </div>
        </div>

        {posts.length === 0 ? (
          <ConfigEmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No blog posts yet"
            description="Write your first article for travellers — drafts stay private until you publish."
            actionLabel="New post"
            actionHref="/admin/config/blogs/new"
          />
        ) : (
          <BlogsTable posts={posts} />
        )}
      </div>
    </div>
  );
}
