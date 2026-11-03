import { redirect } from 'next/navigation';

/** Legacy /blog → /blogs */
export default function BlogIndexRedirect() {
  redirect('/blogs');
}
