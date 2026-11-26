import { permanentRedirect } from 'next/navigation';

/** /visa has no index of its own — send crawlers to home (301). */
export default function VisaIndexPage() {
  permanentRedirect('/');
}
