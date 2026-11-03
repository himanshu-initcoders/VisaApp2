'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteBlogPost } from '@/app/(admin)/admin/config/blogs/actions';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { BlogPost } from '@/lib/db/schema-extended';

interface BlogsTableProps {
  posts: BlogPost[];
}

export function BlogsTable({ posts }: BlogsTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    id: string;
    title: string;
  }>({ open: false, id: '', title: '' });

  const handleConfirmDelete = async () => {
    setDeletingId(confirm.id);
    try {
      const result = await deleteBlogPost(confirm.id);
      if (result.error) {
        alert(result.error);
        return;
      }
      setConfirm({ open: false, id: '', title: '' });
      router.refresh();
    } catch {
      alert('Failed to delete blog post');
    } finally {
      setDeletingId(null);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="py-12 text-center text-slate-helper">No blog posts yet</div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-ash-divider bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ash-divider">
                <th className="px-6 py-4 text-left text-sm font-medium text-portrait-ink">
                  Title
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-portrait-ink">
                  Slug
                </th>
                <th className="px-6 py-4 text-center text-sm font-medium text-portrait-ink">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-medium text-portrait-ink">
                  Updated
                </th>
                <th className="px-6 py-4 text-right text-sm font-medium text-portrait-ink">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-ash-divider last:border-0"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/config/blogs/${post.id}`}
                      className="font-medium text-portrait-ink hover:text-nautical-teal"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-helper">
                    /blogs/{post.slug}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={
                        post.status === 'published'
                          ? 'inline-flex rounded-full bg-mint-wash px-3 py-1 text-xs font-medium text-portrait-ink'
                          : 'inline-flex rounded-full bg-sky-wash px-3 py-1 text-xs font-medium text-slate-helper'
                      }
                    >
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-helper">
                    {post.updatedAt
                      ? new Date(post.updatedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-3">
                      <Link
                        href={`/admin/config/blogs/${post.id}`}
                        className="text-sm text-nautical-teal hover:underline"
                      >
                        Edit
                      </Link>
                      {post.status === 'published' && (
                        <Link
                          href={`/blogs/${post.slug}`}
                          target="_blank"
                          className="text-sm text-slate-helper hover:underline"
                        >
                          View
                        </Link>
                      )}
                      <button
                        type="button"
                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                        disabled={deletingId === post.id}
                        onClick={() =>
                          setConfirm({
                            open: true,
                            id: post.id,
                            title: post.title,
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirm.open}
        title="Delete blog post?"
        message={`“${confirm.title}” will be permanently removed from the site and sitemap.`}
        confirmText="Delete"
        destructive
        loading={deletingId === confirm.id}
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirm({ open: false, id: '', title: '' })}
      />
    </>
  );
}
