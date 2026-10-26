import { Spinner } from '@/components/ui';

export default function Loading() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center text-text-muted">
      <Spinner />
    </div>
  );
}
