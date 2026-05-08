'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/config';

const localeLabels: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newLocale = e.target.value as Locale;
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      aria-label="Select language"
      className="h-7 rounded-full border border-transparent bg-transparent px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:bg-muted focus:text-foreground focus:outline-none"
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  );
}
