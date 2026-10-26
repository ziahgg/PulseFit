import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';

import { ToastProvider } from '@/components/toast';
import './globals.css';

const poppins = Poppins({ variable: '--font-poppins', subsets: ['latin'], weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: { default: 'PulseFit', template: '%s · PulseFit' },
  description: 'Short, guided workouts that fit your schedule — with progress you can actually keep up with.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F4F4F5',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full`}>
      <body className="min-h-full">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
