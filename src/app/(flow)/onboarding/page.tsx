import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { OnboardingForm } from '@/components/onboarding-form';
import { appContext } from '@/lib/app-context';

export const metadata: Metadata = { title: 'Choose your focus' };

export default async function OnboardingPage() {
  const { profile } = await appContext({ allowOnboarding: true });
  if (profile.onboarded_at) redirect('/home');
  return <OnboardingForm initial={profile.focus_areas} />;
}
