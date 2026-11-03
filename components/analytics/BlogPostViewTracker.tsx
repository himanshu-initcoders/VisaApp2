'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics/gtm';

interface BlogPostViewTrackerProps {
  slug: string;
  title: string;
  postId: string;
}

export function BlogPostViewTracker({
  slug,
  title,
  postId,
}: BlogPostViewTrackerProps) {
  useEffect(() => {
    trackEvent('view_blog_post', {
      post_id: postId,
      slug,
      title,
    });
  }, [postId, slug, title]);

  return null;
}
