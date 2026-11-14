import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MotionReveal } from '@/components/public/MotionReveal';
import type { BlogPost } from '@/lib/db/queries/blog';
import { toAppMediaUrl } from '@/lib/upload/mediaUrl';

type RecentBlogsSectionProps = {
  posts: BlogPost[];
  /** Tighter bottom padding when the parent page already has pb-* on main */
  compactBottom?: boolean;
};

export function RecentBlogsSection({
  posts,
  compactBottom = false,
}: RecentBlogsSectionProps) {
  if (posts.length === 0) return null;

  return (
    <section
      className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${
        compactBottom ? 'py-10 sm:py-14' : 'pb-12 pt-4 sm:pb-20 sm:pt-6'
      }`}
    >
      <MotionReveal className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper sm:text-xs sm:tracking-[0.24em]">
            From the blog
          </p>
          <h2 className="mt-2 font-basier text-2xl leading-tight tracking-[-0.03em] text-portrait-ink sm:text-4xl">
            Recent guides for your next trip
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-helper sm:text-base sm:leading-7">
            Practical visa and passport notes from the same team that reviews
            applications.
          </p>
        </div>
        <Link
          href="/blogs"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-portrait-ink"
        >
          View all blogs
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      </MotionReveal>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {posts.map((post, index) => (
          <MotionReveal key={post.id} delayMs={index * 40}>
            <Link
              href={`/blogs/${post.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-ash-divider bg-white transition-shadow hover:shadow-elevated"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-sky-wash">
                {post.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- CMS covers may be local or arbitrary hosts
                  <img
                    src={
                      toAppMediaUrl(post.coverImageUrl) || post.coverImageUrl
                    }
                    alt={post.coverImageAlt || post.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-6">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-helper">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Guide'}
                </p>
                <h3 className="font-basier text-2xl leading-snug text-portrait-ink">
                  {post.title}
                </h3>
                {post.excerpt ? (
                  <p className="line-clamp-3 text-sm leading-6 text-slate-helper">
                    {post.excerpt}
                  </p>
                ) : null}
              </div>
            </Link>
          </MotionReveal>
        ))}
      </div>
    </section>
  );
}
