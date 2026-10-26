'use client';

import { Bookmark } from 'lucide-react';
import { useOptimistic, useTransition } from 'react';

import { setSaved } from '@/app/actions/library';
import { useToast } from './toast';
import { cx } from './ui';

/**
 * Bookmark toggle. Optimistic: the icon flips immediately and React reverts it if the
 * server action fails (the transition ends with the real `saved` prop).
 */
export function SaveButton({ templateId, name, saved, look = 'glass' }: { templateId: string; name: string; saved: boolean; look?: 'glass' | 'plain' | 'surface' }) {
  const toast = useToast();
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();

  const change = (next: boolean, withUndo: boolean) =>
    start(async () => {
      setOptimistic(next);
      const r = await setSaved(templateId, next);
      if (!r.ok) return toast({ kind: 'error', title: 'Couldn’t update Saved', message: r.error });
      toast({
        icon: Bookmark,
        title: next ? 'Saved' : 'Removed from Saved',
        message: name,
        action: withUndo ? { label: 'Undo', onClick: () => change(!next, false) } : undefined,
      });
    });

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Remove ${name} from Saved` : `Save ${name}`}
      disabled={pending}
      onClick={() => change(!optimistic, true)}
      className={cx(
        'grid shrink-0 place-items-center rounded-full transition-colors',
        look === 'glass' && 'size-11 bg-white/85 text-text backdrop-blur hover:bg-white',
        look === 'surface' && 'size-14 border border-border bg-surface text-text',
        look === 'plain' && 'size-10 text-brand',
      )}
    >
      <Bookmark size={look === 'plain' ? 22 : 20} className={cx(optimistic && 'fill-brand text-brand')} aria-hidden />
    </button>
  );
}
