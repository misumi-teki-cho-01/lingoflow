'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

const THEMES = ['system', 'light', 'dark'] as const;

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

  const activeTheme = mounted ? theme ?? 'system' : 'system';
  const Icon =
    activeTheme === 'system' ? Monitor : resolvedTheme === 'dark' || activeTheme === 'dark' ? Moon : Sun;

  return (
    <label className="inline-flex h-7 items-center gap-1.5 rounded-full border border-transparent bg-transparent px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-within:bg-muted focus-within:text-foreground">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{t('label')}</span>
      <select
        value={activeTheme}
        onChange={(event) => setTheme(event.target.value)}
        disabled={!mounted}
        aria-label={t('label')}
        className="max-w-20 cursor-pointer bg-transparent text-xs outline-none disabled:cursor-default disabled:opacity-60"
      >
        {THEMES.map((value) => (
          <option key={value} value={value}>
            {t(value)}
          </option>
        ))}
      </select>
    </label>
  );
}
