import { permanentRedirect } from 'next/navigation';

/** Legacy /blog → /blogs (301). */
export default function BlogIndexRedirect() {
  permanentRedirect('/blogs');
}
