'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface FooterNavLinkProps {
  href: string;
  label: string;
}

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const section = document.getElementById(id);
  if (!section) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.history.replaceState(null, '', `#${id}`);
}

/**
 * Footer links that soft-scroll when the user is already on the target page
 * (e.g. `/#visas` while on home, `/passport` while on the passport hub).
 */
export function FooterNavLink({ href, label }: FooterNavLinkProps) {
  const pathname = usePathname();
  const [path, hash = ''] = href.split('#');
  const targetPath = path || '/';
  const isSamePage = pathname === targetPath;

  return (
    <Link
      href={href}
      className="text-sm text-white/70 hover:text-white transition-colors"
      onClick={(event) => {
        if (!isSamePage) return;
        event.preventDefault();
        scrollToHash(hash);
      }}
    >
      {label}
    </Link>
  );
}
