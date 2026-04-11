import { getTranslations } from "next-intl/server";
import { VideoImportForm } from "@/components/video/video-import-form";
import { VideoCard, type VideoCardData } from "@/components/video/video-card";
import { createClient } from "@/lib/supabase/server";
import { Play, Tv2, AlertCircle } from "lucide-react";

// ── Data fetching ──────────────────────────────────────────────────────────
async function getImportedVideos(): Promise<VideoCardData[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("videos")
      .select(
        "video_ext_id, title, channel_name, thumbnail_url, duration, source_type"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    return (data as VideoCardData[]) ?? [];
  } catch {
    return [];
  }
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [t, { error: errorParam }, videos] = await Promise.all([
    getTranslations("dashboard"),
    searchParams,
    getImportedVideos(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 flex flex-col gap-16">

      {/* ── Import Hero ── */}
      <section className="flex flex-col items-center text-center gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
        </div>

        <VideoImportForm />

        {/* No-subtitle error notice (redirected back from video page) */}
        {errorParam === "no-subtitles" && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive max-w-md">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {t("errorNoSubtitles")}
          </p>
        )}
      </section>

      {/* ── Video Library ── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <Tv2 className="h-4 w-4" />
          {t("recentImports")}
        </h2>

        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
            <div className="rounded-full bg-muted p-6 mb-4">
              <Play className="h-8 w-8 opacity-30" />
            </div>
            <p className="font-medium">{t("noVideos")}</p>
            <p className="text-sm mt-1 opacity-60">{t("noVideosHint")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video) => (
              <VideoCard key={video.video_ext_id} video={video} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
