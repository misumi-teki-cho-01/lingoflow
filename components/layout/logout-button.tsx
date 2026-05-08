'use client';
import { useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export function LogoutButton() {
  const router = useRouter();
  const t = useTranslations('nav');

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    localStorage.removeItem('lingo-remember');
    router.replace('/');
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      className="rounded-full px-3 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {t('logout')}
    </Button>
  );
}
