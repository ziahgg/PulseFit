import type { Metadata } from 'next';
import Image from 'next/image';

import { PulseMark } from '@/components/nav';
import { ButtonLink } from '@/components/ui';

export const metadata: Metadata = { title: 'Welcome' };

/** Figma 00 Welcome: photo, brand mark, headline, primary + secondary actions. */
export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-bg lg:my-8 lg:min-h-0 lg:overflow-hidden lg:rounded-[32px]">
      <div className="relative h-[52dvh] min-h-[320px] lg:h-[420px]">
        <Image src="/images/mobility.jpg" alt="Person sitting cross-legged on a yoga mat, twisting gently" fill priority sizes="520px" className="photo object-cover" />
      </div>
      <section className="relative -mt-8 flex flex-1 flex-col rounded-t-[32px] bg-bg px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))]">
        <p className="flex items-center gap-2.5 t-section">
          <span className="grid size-9 place-items-center rounded-full bg-brand text-on-brand">
            <PulseMark />
          </span>
          PulseFit
        </p>
        <h1 className="mt-5 t-title-xl">Move a little, every week.</h1>
        <p className="mt-3 t-body text-text-secondary">Short, guided workouts that fit your schedule — with progress you can actually keep up with.</p>
        <div className="mt-auto flex flex-col gap-3 pt-10">
          <ButtonLink href="/signup" full>
            Get started
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" full>
            I already have an account
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}
