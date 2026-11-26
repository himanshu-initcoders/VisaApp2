import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata({
  title: 'Create staff account',
  description:
    'Create a Viserv staff account. This registration page is not indexed by search engines.',
  path: '/register',
});

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
