import { createClient } from "@/lib/supabase/server";
import type { TranscriptSegment } from "@/types/transcript";
import type { TranscriptSource } from "./transcription-pipeline";

// Only these quality levels are worth caching
const CACHEABLE_QUALITIES: TranscriptSource[] = [
  "subtitle-raw",
  "subtitle-enhanced",
  "audio-transcribed",
];

// Quality priority: higher index = better quality
const QUALITY_RANK: Record<string, number> = {
  "subtitle-raw": 0,
  "audio-transcribed": 1,
  "subtitle-enhanced": 2,
};

export interface CacheEntry {
  transcriptId: string;
  segments: TranscriptSegment[];
  quality: TranscriptSource;
}

/**
 * Reads a cached transcript from the `transcripts` table via the video's
 * external ID (e.g. YouTube video ID stored in videos.video_ext_id).
 *
 * Looks up: videos → transcripts (joined on video_id).
 * Returns the highest-quality available entry, or null if nothing cached.
 */
export async function readTranscriptCache(
  videoExtId: string,
  lang: string = "en"
): Promise<CacheEntry | null> {
  try {
    const supabase = await createClient();

    // Join videos → transcripts using video_ext_id
    const { data, error } = await supabase
      .from("transcripts")
      .select("id, segments, quality, videos!inner(video_ext_id)")
      .eq("videos.video_ext_id", videoExtId)
      .eq("language", lang)
      .eq("status", "completed")
      .in("quality", CACHEABLE_QUALITIES)
      .order("quality", { ascending: false }) // alphabetical: 'subtitle-raw' < 'subtitle-enhanced'
      .limit(5); // get all qualities, we'll pick best manually

    if (error || !data || data.length === 0) return null;

    // Pick highest-quality entry
    const best = data.reduce((prev, curr) => {
      const prevRank = QUALITY_RANK[prev.quality ?? ""] ?? -1;
      const currRank = QUALITY_RANK[curr.quality ?? ""] ?? -1;
      return currRank > prevRank ? curr : prev;
    });

    return {
      transcriptId: best.id,
      segments: best.segments as TranscriptSegment[],
      quality: best.quality as TranscriptSource,
    };
  } catch {
    return null;
  }
}

/**
 * Writes or upgrades a transcript entry in the `transcripts` table.
 * - If a lower-quality entry exists, upgrades it in-place (UPDATE).
 * - If no entry exists, inserts a new one.
 *
 * This function is intentionally fire-and-forget (non-blocking).
 */
export async function writeTranscriptCache(
  videoExtId: string,
  lang: string = "en",
  quality: TranscriptSource,
  segments: TranscriptSegment[],
  existingTranscriptId?: string
): Promise<void> {
  if (!CACHEABLE_QUALITIES.includes(quality) || segments.length === 0) return;

  try {
    const supabase = await createClient();

    if (existingTranscriptId) {
      // Upgrade existing row to better quality
      await supabase
        .from("transcripts")
        .update({
          segments,
          quality,
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTranscriptId);
      return;
    }

    // Find the video's internal UUID first
    const { data: video } = await supabase
      .from("videos")
      .select("id")
      .eq("video_ext_id", videoExtId)
      .single();

    if (!video) return; // Video not in DB yet — skip caching for now

    // Insert new transcript row (upsert on video_id + language)
    await supabase.from("transcripts").upsert(
      {
        video_id: video.id,
        language: lang,
        segments,
        quality,
        status: "completed",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "video_id,language" }
    );
  } catch {
    // Cache write failure is non-fatal
  }
}
