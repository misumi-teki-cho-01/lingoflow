'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const THEMES = ['system', 'light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

function subscribe() {
  return () => {};
}

export function ThemeSwitcher() {
  const t = useTranslations('theme');
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const activeTheme = (mounted ? (theme ?? 'system') : 'system') as Theme;
  const Icon =
    activeTheme === 'system'
      ? Monitor
      : resolvedTheme === 'dark' || activeTheme === 'dark'
        ? Moon
        : Sun;

  return (
    <Select<Theme>
      value={activeTheme}
      onValueChange={(value) => {
        if (value) setTheme(value);
      }}
      disabled={!mounted}
    >
      <SelectTrigger
        aria-label={t('label')}
        className="h-7 gap-1.5 rounded-full border-transparent bg-transparent px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground disabled:opacity-60 dark:bg-transparent dark:hover:bg-muted"
        showIcon={false}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <SelectValue className="max-w-20">{t(activeTheme)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {THEMES.map((value) => (
          <SelectItem key={value} value={value}>
            {t(value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
