import { Pencil } from 'lucide-react';
import type { Metadata } from 'next';

import { ProfileSettings } from '@/components/profile-settings';
import { Screen } from '@/components/screen';
import { Card, IconButton, PageTitle } from '@/components/ui';
import { appContext } from '@/lib/app-context';
import { monthShortLabel } from '@/lib/domain/dates';
import { isFinished, weekStreak } from '@/lib/domain/workouts';
import { listGoals, listWorkouts, savedTemplateIds, unreadCount } from '@/lib/services/data';

export const metadata: Metadata = { title: 'Profile' };

/** Figma 10 Profile & settings. */
export default async function ProfilePage() {
  const { db, userId, profile, today, email } = await appContext();
  const [workouts, goals, saved, unread] = await Promise.all([listWorkouts(db, userId, { limit: 1000 }), listGoals(db, userId), savedTemplateIds(db, userId), unreadCount(db, userId)]);
  const finished = workouts.filter(isFinished);
  const freq = goals.find((g) => g.goal_type === 'workout_frequency' && g.status === 'active');
  const streak = weekStreak(finished, today, freq ? Number(freq.target_value) : 1);
  const initials = profile.display_name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'PF';

  return (
    <Screen>
      <PageTitle title="Profile" />
      <Card className="flex items-center gap-4 p-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-ink t-title text-on-ink" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-card-title truncate">{profile.display_name || 'Your name'}</p>
          <p className="t-body truncate text-text-muted">Member since {monthShortLabel(profile.created_at.slice(0, 10))}</p>
        </div>
        <IconButton icon={Pencil} label="Edit profile" look="muted" href="/profile/edit" />
      </Card>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="t-metric-m num">{finished.length}</p>
          <p className="t-label text-text-muted">Workouts</p>
        </Card>
        <Card className="p-4">
          <p className="t-metric-m num">{streak} wks</p>
          <p className="t-label text-text-muted">Streak</p>
        </Card>
        <Card className="p-4">
          <p className="t-metric-m num">{saved.size}</p>
          <p className="t-label text-text-muted">Saved</p>
        </Card>
      </div>
      <ProfileSettings
        email={email}
        activeGoals={goals.filter((g) => g.status === 'active').length}
        unread={unread}
        focus={profile.focus_areas}
        level={profile.experience_level}
        units={profile.preferred_units}
        reminders={profile.reminders_enabled}
        reminderTime={profile.reminder_time.slice(0, 5)}
      />
    </Screen>
  );
}
