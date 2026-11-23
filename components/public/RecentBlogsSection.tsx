import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { MotionReveal } from '@/components/public/MotionReveal';
import { MediaImage } from '@/components/shared/MediaImage';
import type { BlogPost } from '@/lib/db/queries/blog';

type RecentBlogsSectionProps = {
  posts: BlogPost[];
  /** Tighter bottom padding when the parent page already has pb-* on main */
  compactBottom?: boolean;
  /** Skip outer max-width/padding when nested inside a listing content column */
  embedded?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
};

export function RecentBlogsSection({
  posts,
  compactBottom = false,
  embedded = false,
  eyebrow = 'From the blog',
  title = 'Recent guides for your next trip',
  description = 'Practical visa and passport notes from the same team that reviews applications.',
}: RecentBlogsSectionProps) {
  if (posts.length === 0) return null;

  const header = (
    <MotionReveal
      className={`mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between ${
        embedded ? 'mb-5 sm:mb-6' : ''
      }`}
    >
      <div className="max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-helper sm:text-xs sm:tracking-[0.24em]">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-basier text-2xl leading-tight tracking-[-0.03em] text-portrait-ink sm:text-4xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-slate-helper sm:text-base sm:leading-7">
            {description}
          </p>
        ) : null}
      </div>
      <Link
        href="/blogs"
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-portrait-ink"
      >
        View all blogs
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    </MotionReveal>
  );

  const grid = (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {posts.map((post, index) => (
        <MotionReveal key={post.id} delayMs={index * 40}>
          <Link
            href={`/blogs/${post.slug}`}
            className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-ash-divider bg-white transition-shadow hover:shadow-elevated"
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-sky-wash">
              {post.coverImageUrl ? (
                <MediaImage
                  src={post.coverImageUrl}
                  alt={post.coverImageAlt || post.title}
                  fill
                  sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
  );

  if (embedded) {
    return (
      <div className="space-y-0">
        {header}
        {grid}
      </div>
    );
  }

  return (
    <section
      className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${
        compactBottom ? 'pb-10 pt-4 sm:pb-14 sm:pt-6' : 'pb-12 pt-4 sm:pb-20 sm:pt-6'
      }`}
    >
      {header}
      {grid}
    </section>
  );
}
