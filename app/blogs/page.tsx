import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MotionReveal } from '@/components/public/MotionReveal';
import { JsonLd } from '@/components/seo/JsonLd';
import { getPublishedPosts } from '@/lib/db/queries/blog';
import {
  buildBreadcrumbJsonLd,
  buildWebPageJsonLd,
} from '@/lib/seo/jsonld';

export const revalidate = 3600;

const PAGE_TITLE = 'Visa & passport guides — Viserv Blog';
const PAGE_DESCRIPTION =
  'Practical guides for Indian travellers: visa tips, passport renewals, documents, and destination checklists from Viserv.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/blogs' },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: '/blogs',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
  },
};

export default async function BlogIndexPage() {
  const posts = await getPublishedPosts();

  return (
    <>
      <JsonLd
        data={[
          buildWebPageJsonLd({
            title: PAGE_TITLE,
            description: PAGE_DESCRIPTION,
            path: '/blogs',
          }),
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blogs' },
          ]),
        ]}
      />
      <Header />
      <main className="min-h-screen bg-[#f8f6f1] px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          <MotionReveal className="max-w-3xl space-y-4">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-helper">
              Blog
            </p>
            <h1 className="font-basier text-5xl leading-tight text-portrait-ink">
              Guides for calmer visa and passport journeys.
            </h1>
            <p className="text-base leading-8 text-slate-helper">
              Clear checklists and destination notes for Indian travellers —
              written alongside the same operations team that reviews your
              applications.
            </p>
          </MotionReveal>

          {posts.length === 0 ? (
            <p className="text-base text-slate-helper">
              New articles are on the way. Check back soon.
            </p>
          ) : (
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
                          src={post.coverImageUrl}
                          alt={post.coverImageAlt || post.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col gap-3 p-6">
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-helper">
                        {post.publishedAt
                          ? new Date(post.publishedAt).toLocaleDateString(
                              'en-IN',
                              {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }
                            )
                          : 'Guide'}
                      </p>
                      <h2 className="font-basier text-2xl leading-snug text-portrait-ink">
                        {post.title}
                      </h2>
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
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
