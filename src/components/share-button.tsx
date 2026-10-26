'use client';

import { Share2 } from 'lucide-react';

import { useToast } from './toast';
import { IconButton } from './ui';

/** Shares a short text summary (Web Share API, falling back to the clipboard). No data leaves the device otherwise. */
export function ShareButton({ text, look = 'surface' }: { text: string; look?: 'surface' | 'glass' }) {
  const toast = useToast();
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'PulseFit', text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard', message: text });
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') toast({ kind: 'error', title: 'Couldn’t share', message: 'Sharing isn’t available here.' });
    }
  };
  return <IconButton icon={Share2} label="Share summary" look={look} onClick={share} />;
}
