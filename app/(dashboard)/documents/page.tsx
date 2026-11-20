import { redirect } from 'next/navigation';

/** Legacy URL — vault lives at /traveller-profiles. */
export default function DocumentsRedirectPage() {
  redirect('/traveller-profiles');
}
