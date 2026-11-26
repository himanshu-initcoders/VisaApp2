import { permanentRedirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Legacy /blog/[slug] → /blogs/[slug] (301). */
export default async function BlogPostRedirect({ params }: PageProps) {
  const { slug } = await params;
  permanentRedirect(`/blogs/${slug}`);
}
