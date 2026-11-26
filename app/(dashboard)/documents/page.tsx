import { permanentRedirect } from 'next/navigation';

/** Legacy URL — vault lives at /traveller-profiles (301). */
export default function DocumentsRedirectPage() {
  permanentRedirect('/traveller-profiles');
}
