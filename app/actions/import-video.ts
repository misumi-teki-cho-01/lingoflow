"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseVideoUrl } from "@/lib/utils/url-parser";
import { fetchYouTubeMeta } from "@/lib/utils/youtube-meta";
import { runTranscriptionPipeline } from "@/lib/pipeline/transcription-pipeline";

export interface ImportVideoState {
  error?: string;   // i18n key, e.g. "invalidUrl" — mapped to t() in the form
  field?: "url";
}

/**
 * Server Action: import a video by URL.
 *
 * Flow:
 *  1. Validate URL → extract source + videoId
 *  2. Check videos table — already imported? → redirect immediately
 *  3. Fetch metadata (oEmbed) + run transcription pipeline in parallel
 *  4. No subtitles → return error (don't persist)
 *  5. Persist video + transcript → redirect to /video/{videoExtId}
 */
export async function importVideo(
  locale: string,
  _prevState: ImportVideoState,
  formData: FormData
): Promise<ImportVideoState> {
  const url = formData.get("url")?.toString().trim() ?? "";

  // ── 1. Validate URL ────────────────────────────────────────────────────────
  const parsed = parseVideoUrl(url);
  if (!parsed) {
    return { error: "invalidUrl", field: "url" };
  }
  if (parsed.source === "bilibili") {
    return { error: "bilibiliUnsupported", field: "url" };
  }

  const { videoId, source } = parsed;
  const supabase = await createClient();

  // ── 2. Already imported? ───────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("videos")
    .select("video_ext_id")
    .eq("video_ext_id", videoId)
    .single();

  if (existing) {
    redirect(`/${locale}/video/${videoId}`);
  }

  // ── 3. Fetch metadata + subtitles in parallel ──────────────────────────────
  const [meta, transcriptResult] = await Promise.all([
    fetchYouTubeMeta(videoId),
    runTranscriptionPipeline(source, videoId, "en"),
  ]);

  // ── 4. No subtitles → return error, don't persist ─────────────────────────
  if (transcriptResult.source === "failed" || transcriptResult.segments.length === 0) {
    return { error: "noSubtitles", field: "url" };
  }

  // ── 5. Persist video ───────────────────────────────────────────────────────
  const { data: video, error: videoErr } = await supabase
    .from("videos")
    .insert({
      url: parsed.url,
      source_type: source,
      video_ext_id: videoId,
      title: meta.title || null,
      channel_name: meta.channelName || null,
      thumbnail_url: meta.thumbnailUrl || null,
      language: "en",
    })
    .select("id")
    .single();

  if (videoErr || !video) {
    return { error: "saveFailed" };
  }

  // ── 5b. Persist transcript (upsert — pipeline may have already cached it) ──
  await supabase.from("transcripts").upsert(
    {
      video_id: video.id,
      language: "en",
      segments: transcriptResult.segments,
      quality: transcriptResult.source,
      status: "completed",
    },
    { onConflict: "video_id,language" }
  );

  // ── 6. Redirect to study page ─────────────────────────────────────────────
  redirect(`/${locale}/video/${videoId}`);
}
