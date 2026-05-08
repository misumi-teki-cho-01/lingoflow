import { getTranslations } from 'next-intl/server';
import { VideoImportForm } from '@/components/video/video-import-form';
import { type VideoCardData } from '@/components/video/video-card';
import { DashboardVideoLibrary } from '@/components/dashboard/dashboard-video-library';
import { getRecentVideos } from '@/lib/db/videos';
import { AlertCircle } from 'lucide-react';

// ── Data fetching ──────────────────────────────────────────────────────────
async function getImportedVideos(): Promise<VideoCardData[]> {
  const data = await getRecentVideos(24);
  return (data as VideoCardData[]) ?? [];
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [t, { error: errorParam }, videos] = await Promise.all([
    getTranslations('dashboard'),
    searchParams,
    getImportedVideos(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 flex flex-col gap-16">
      {/* ── Import Hero ── */}
      <section className="flex flex-col items-center text-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('subtitle')}</p>
        </div>

        <VideoImportForm />

        {/* No-subtitle error notice (redirected back from video page) */}
        {errorParam === 'no-subtitles' && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {t('errorNoSubtitles')}
          </p>
        )}
      </section>

      {/* ── Video Library ── */}
      <DashboardVideoLibrary videos={videos} />
    </div>
  );
}
