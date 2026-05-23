'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Captions, ChevronLeft, Clapperboard, Headphones, PenLine } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildVideoModeHref, type VideoEntryMode } from '@/lib/study-room/study-mode-routing';
import { cn } from '@/lib/utils';

interface VideoSessionHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  videoId: string;
  title?: string | null;
  activeMode: VideoEntryMode;
  onStudyModeChange?: (mode: Exclude<VideoEntryMode, 'cinema'>) => void;
  actions?: ReactNode;
  trailing?: ReactNode;
}

const modeIcons = {
  cc: Captions,
  scribe: Headphones,
  fill: PenLine,
  cinema: Clapperboard,
};

export function VideoSessionHeader({
  videoId,
  title,
  activeMode,
  onStudyModeChange,
  actions,
  trailing,
  className,
  ...headerProps
}: VideoSessionHeaderProps) {
  const t = useTranslations('studyRoom');
  const labels = {
    cc: t('ccMode'),
    scribe: t('echoScribeMode'),
    fill: t('fillMode'),
    cinema: t('cinemaMode'),
  };

  const renderStudyMode = (mode: Exclude<VideoEntryMode, 'cinema'>) => {
    const Icon = modeIcons[mode];
    const isActive = activeMode === mode;
    const content = (
      <>
        <Icon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{labels[mode]}</span>
      </>
    );
    const className = cn(
      'flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-all',
      isActive
        ? 'bg-primary text-primary-foreground shadow-sm'
        : 'text-muted-foreground hover:bg-background hover:text-foreground',
    );

    if (onStudyModeChange) {
      return (
        <button
          key={mode}
          type="button"
          onClick={() => onStudyModeChange(mode)}
          className={className}
        >
          {content}
        </button>
      );
    }

    return (
      <Link key={mode} href={buildVideoModeHref(videoId, mode)} className={className}>
        {content}
      </Link>
    );
  };

  return (
    <header
      {...headerProps}
      className={cn(
        'z-30 flex min-h-12 items-center gap-3 border-b border-border/70 bg-background/85 px-4 py-2 shadow-sm backdrop-blur-md',
        className,
      )}
    >
      <Link
        href="/dashboard"
        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {t('back')}
      </Link>

      <span className="hidden text-xs text-muted-foreground sm:inline" aria-hidden>
        ·
      </span>

      <span
        className="min-w-0 max-w-[160px] truncate text-xs font-mono text-muted-foreground sm:max-w-[240px] lg:max-w-md"
        title={title || videoId}
      >
        {title || videoId}
      </span>

      <div className="flex-1" />

      <nav className="flex shrink-0 items-center gap-1.5 text-xs" aria-label={t('modeNavLabel')}>
        <div className="flex items-center rounded-full border border-border bg-muted/35 p-0.5">
          {(['cc', 'scribe', 'fill'] as const).map(renderStudyMode)}
        </div>
        <Link
          href={buildVideoModeHref(videoId, 'cinema')}
          className={cn(
            'flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all',
            activeMode === 'cinema'
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-background/80 text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          <Clapperboard className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{labels.cinema}</span>
        </Link>
      </nav>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </header>
  );
}
