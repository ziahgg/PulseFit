import { ButtonLink } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="t-title">Not found</h1>
      <p className="t-body text-text-secondary">This page doesn’t exist, or it belongs to another account.</p>
      <ButtonLink href="/home" className="mt-2">
        Back to Home
      </ButtonLink>
    </main>
  );
}
