import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { SessionPlayer } from '@/components/session-player';
import { appContext } from '@/lib/app-context';
import { requestTime } from '@/lib/request-time';
import { getSession } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Workout in progress' };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, profile } = await appContext();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const session = await getSession(db, id);
  if (!session) notFound();
  if (session.status !== 'in_progress') redirect(`/session/${id}/complete`);
  return <SessionPlayer session={session} units={profile.preferred_units} serverNow={requestTime()} />;
}
