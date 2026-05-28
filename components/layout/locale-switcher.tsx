'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales, type Locale } from '@/i18n/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const localeLabels: Record<Locale, string> = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select<Locale>
      value={locale as Locale}
      onValueChange={(newLocale) => {
        if (newLocale) router.replace(pathname, { locale: newLocale });
      }}
    >
      <SelectTrigger
        aria-label="Select language"
        className="h-7 rounded-full border-transparent bg-transparent px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground dark:bg-transparent dark:hover:bg-muted"
      >
        <SelectValue>{localeLabels[locale as Locale]}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            {localeLabels[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
