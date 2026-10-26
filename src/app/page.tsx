import { redirect } from 'next/navigation';

/** The proxy sends visitors to /welcome and signed-in users to /home; this is the fallback. */
export default function Root() {
  redirect('/home');
}
