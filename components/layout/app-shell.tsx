'use client';

import { usePathname } from '@/i18n/navigation';
import { Header } from '@/components/layout/header';
import { SessionGuard } from '@/components/auth/session-guard';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVideoPage = pathname.includes('/video/');

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <SessionGuard />
      {!isVideoPage && <Header />}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
