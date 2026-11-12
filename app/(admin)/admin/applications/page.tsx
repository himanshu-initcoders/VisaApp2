import { redirect } from 'next/navigation';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Legacy combined Applications URL — send users to the matching list page.
 */
export default async function ApplicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const typeRaw = params.type;
  const type = Array.isArray(typeRaw) ? typeRaw[0] : typeRaw;
  const target =
    type === 'passport'
      ? '/admin/applications/passport'
      : '/admin/applications/visa';

  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === 'type' || value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else {
      next.set(key, value);
    }
  }

  const qs = next.toString();
  redirect(qs ? `${target}?${qs}` : target);
}
