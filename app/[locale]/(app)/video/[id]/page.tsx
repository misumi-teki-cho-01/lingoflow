import { notFound, redirect } from "next/navigation";
import { StudyRoom, type StudyMode } from "@/components/study-room/study-room";
import { runTranscriptionPipeline } from "@/lib/pipeline/transcription-pipeline";
import { fetchYouTubeMeta, type YouTubeMeta } from "@/lib/utils/youtube-meta";
import { createClient } from "@/lib/supabase/server";
import type { TranscriptSegment } from "@/types/transcript";
import type { TranscriptSource } from "@/lib/pipeline/transcription-pipeline";

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// ── DB lookup ──────────────────────────────────────────────────────────────
interface DBVideo {
  id: string;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
}

interface DBTranscript {
  segments: TranscriptSegment[];
  quality: TranscriptSource;
}

async function getVideoFromDB(videoExtId: string): Promise<{
  video: DBVideo | null;
  transcript: DBTranscript | null;
}> {
  try {
    const supabase = await createClient();

    const { data: video } = await supabase
      .from("videos")
      .select("id, title, channel_name, thumbnail_url")
      .eq("video_ext_id", videoExtId)
      .single();

    if (!video) return { video: null, transcript: null };

    const { data: transcript } = await supabase
      .from("transcripts")
      .select("segments, quality")
      .eq("video_id", video.id)
      .eq("language", "en")
      .eq("status", "completed")
      .single();

    return {
      video,
      transcript: transcript
        ? { segments: transcript.segments as TranscriptSegment[], quality: transcript.quality as TranscriptSource }
        : null,
    };
  } catch {
    return { video: null, transcript: null };
  }
}

// ── Page ───────────────────────────────────────────────────────────────────
export default async function VideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { locale, id } = await params;
  const { mode } = await searchParams;

  if (!YT_ID_RE.test(id)) notFound();

  const defaultMode: StudyMode = mode === "cc" ? "cc" : "scribe";
  const videoUrl = `https://www.youtube.com/watch?v=${id}`;

  // ── Try DB first ───────────────────────────────────────────────────────────
  const { video: dbVideo, transcript: dbTranscript } = await getVideoFromDB(id);

  let videoMeta: YouTubeMeta;
  let segments: TranscriptSegment[];
  let transcriptSource: TranscriptSource;

  if (dbVideo && dbTranscript) {
    // Fast path: everything is in DB already
    videoMeta = {
      title: dbVideo.title ?? "",
      channelName: dbVideo.channel_name ?? "",
      thumbnailUrl: dbVideo.thumbnail_url ?? "",
    };
    segments = dbTranscript.segments;
    transcriptSource = dbTranscript.quality;
  } else {
    // Fallback: video accessed directly (not via import flow)
    const [meta, result] = await Promise.all([
      fetchYouTubeMeta(id),
      runTranscriptionPipeline("youtube", id, "en"),
    ]);

    if (result.source === "failed" || result.segments.length === 0) {
      redirect(`/${locale}/dashboard?error=no-subtitles&video=${id}`);
    }

    videoMeta = meta;
    segments = result.segments;
    transcriptSource = result.source;
  }

  return (
    <StudyRoom
      videoId={id}
      videoMeta={videoMeta}
      videoUrl={videoUrl}
      segments={segments}
      transcriptSource={transcriptSource}
      defaultMode={defaultMode}
    />
  );
}
