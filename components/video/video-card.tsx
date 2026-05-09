'use client';

import { Link } from '@/i18n/navigation';
import { useState } from 'react';
import { Play, Clock, Film } from 'lucide-react';
import { formatTime } from '@/lib/utils/format';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, ja, enUS, type Locale } from 'date-fns/locale';
import { useLocale, useTranslations } from 'next-intl';

export interface VideoCardData {
  video_ext_id: string;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  source_type: string;
  created_at: string;
}

const DATE_LOCALES: Record<string, Locale> = {
  zh: zhCN,
  ja: ja,
  en: enUS,
};

interface VideoCardProps {
  video: VideoCardData;
}

const SOURCE_BADGE_STYLES: Record<string, string> = {
  youtube: 'bg-red-100 text-muted-foreground',
  bilibili: 'bg-sky-100 text-muted-foreground',
};

/**
 * Reusable video card — links to /video/{video_ext_id}.
 * Displays thumbnail, title, duration badge, and compact metadata.
 */
export function VideoCard({ video }: VideoCardProps) {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnail =
    !imageFailed && video.thumbnail_url
      ? video.thumbnail_url
      : !imageFailed && video.source_type === 'youtube'
        ? `https://img.youtube.com/vi/${video.video_ext_id}/hqdefault.jpg`
        : null;

  const relativeTime = formatDistanceToNow(new Date(video.created_at), {
    addSuffix: true,
    locale: DATE_LOCALES[locale] ?? enUS,
  });

  return (
    <Link
      href={`/video/${video.video_ext_id}`}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {thumbnail ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbnail}
            alt={video.title ?? 'Video thumbnail'}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            <Film className="h-10 w-10 opacity-40" />
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
          <div className="rounded-full bg-white/90 p-3 shadow-lg">
            <Play className="h-5 w-5 fill-black text-black" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {video.title ?? video.video_ext_id}
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground/60">
            <p suppressHydrationWarning className="min-w-0 truncate">
              {relativeTime}
            </p>
            {video.duration != null && (
              <span className="flex shrink-0 items-center gap-1 font-mono">
                <Clock className="h-2.5 w-2.5" />
                {formatTime(video.duration)}
              </span>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-1.5">
            {video.channel_name && (
              <span className="min-w-0 truncate rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                {video.channel_name}
              </span>
            )}
            <span
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-medium ${
                SOURCE_BADGE_STYLES[video.source_type] ?? 'bg-muted text-muted-foreground'
              }`}
            >
              {t(`source.${video.source_type}`)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
