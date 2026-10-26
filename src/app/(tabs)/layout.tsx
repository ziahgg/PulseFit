import { AppNav } from '@/components/nav';
import { appContext } from '@/lib/app-context';

export default async function TabsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await appContext();
  return (
    <div className="min-h-dvh lg:pl-[232px]">
      {children}
      <AppNav />
    </div>
  );
}
