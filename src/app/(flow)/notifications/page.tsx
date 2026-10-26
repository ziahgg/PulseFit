import { Bell, Settings } from 'lucide-react';
import type { Metadata } from 'next';

import { NotificationList } from '@/components/notification-list';
import { Screen } from '@/components/screen';
import { EmptyState, IconButton, TopBar } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { addDays, dayLabel, localDate, localTime } from '@/lib/domain/dates';
import { listNotifications } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const { db, userId, today, profile } = await appContext();
  const rows = await listNotifications(db, userId);
  const weekAgo = addDays(today, -6);
  const items = rows.map((n) => {
    const day = localDate(n.created_at, profile.timezone);
    return { ...n, group: day === today ? 'Today' : day >= weekAgo ? 'This week' : 'Earlier', when: day === today ? localTime(n.created_at, profile.timezone) : dayLabel(day) };
  });
  return (
    <Screen>
      <TopBar title="Notifications" back="/home" right={<IconButton icon={Settings} label="Notification settings" href="/profile" />} />
      {items.length ? <NotificationList items={items} /> : <EmptyState icon={Bell} title="You’re all caught up" message="Streaks, goal progress and personal bests show up here after your workouts." />}
    </Screen>
  );
}
