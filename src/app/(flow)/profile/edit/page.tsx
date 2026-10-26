import type { Metadata } from 'next';

import { ProfileForm } from '@/components/profile-form';
import { appContext } from '@/lib/app-context';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function EditProfilePage() {
  const { profile } = await appContext();
  return (
    <ProfileForm
      initial={{ displayName: profile.display_name, experienceLevel: profile.experience_level, preferredUnits: profile.preferred_units, heightCm: profile.height_cm === null ? null : Number(profile.height_cm), timezone: profile.timezone }}
    />
  );
}
