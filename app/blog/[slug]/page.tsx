import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Legacy /blog/[slug] → /blogs/[slug] */
export default async function BlogPostRedirect({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/blogs/${slug}`);
}
