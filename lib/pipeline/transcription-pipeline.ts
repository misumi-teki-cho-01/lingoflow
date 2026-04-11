import type { TranscriptSegment } from "@/types/transcript";
import type { VideoSourceType } from "@/types/video";
import { fetchSubtitles } from "./subtitle-fetcher";
import { enhanceWithAI } from "./ai-enhancer";
import { readTranscriptCache, writeTranscriptCache } from "./transcript-cache";

export type TranscriptSource =
  | "subtitle-enhanced"   // Level 1+2: subtitles found and AI-enhanced
  | "subtitle-raw"        // Level 1 only: subtitles found, AI unavailable
  | "audio-transcribed"   // Level 3: no subtitles, used audio transcription
  | "failed";             // All levels failed

export interface PipelineResult {
  segments: TranscriptSegment[];
  source: TranscriptSource;
  subtitleType: "manual" | "auto-generated" | "none";
  aiEnhanced: boolean;
  fromCache: boolean;
  error?: string;
}

/**
 * Three-level transcription pipeline with Supabase caching.
 *
 * Cache logic:
 *   ┌─ Cache hit: subtitle-enhanced ──→ return immediately (best quality)
 *   ├─ Cache hit: subtitle-raw ────────→ try AI upgrade
 *   │     AI available → enhance → upgrade cache → return enhanced
 *   │     AI unavailable → return raw from cache
 *   └─ Cache miss ──────────────────→ run full pipeline, write to cache
 *
 * Pipeline levels:
 *   Level 1: Fetch subtitles from YouTube (fast, free)
 *   Level 2: AI enhancement via Gemini (low cost, text tokens only)
 *   Level 3: No subtitles → return "failed" (audio not implemented)
 */
export async function runTranscriptionPipeline(
  sourceType: VideoSourceType,
  videoId: string,
  preferredLang: string = "en",
): Promise<PipelineResult> {

  // ─── Cache check ──────────────────────────────────────────────────────────
  const cached = await readTranscriptCache(videoId, preferredLang);

  if (cached) {
    // Best quality already cached — return immediately
    if (cached.quality === "subtitle-enhanced" || cached.quality === "audio-transcribed") {
      return {
        segments: cached.segments,
        source: cached.quality,
        subtitleType: cached.quality === "subtitle-enhanced" ? "manual" : "auto-generated",
        aiEnhanced: cached.quality === "subtitle-enhanced",
        fromCache: true,
      };
    }

    // Lower quality (subtitle-raw) cached — try to upgrade with AI
    if (cached.quality === "subtitle-raw") {
      const enhanced = await enhanceWithAI(cached.segments);
      if (enhanced.enhanced) {
        // Upgrade the cached entry in-place
        writeTranscriptCache(
          videoId, preferredLang, "subtitle-enhanced",
          enhanced.segments, cached.transcriptId
        );
        return {
          segments: enhanced.segments,
          source: "subtitle-enhanced",
          subtitleType: "auto-generated",
          aiEnhanced: true,
          fromCache: false, // content is fresh
        };
      }
      // AI not available — raw cache is good enough
      return {
        segments: cached.segments,
        source: "subtitle-raw",
        subtitleType: "auto-generated",
        aiEnhanced: false,
        fromCache: true,
      };
    }
  }

  // ─── Level 1: Fetch subtitles ─────────────────────────────────────────────
  const subtitleResult = await fetchSubtitles(sourceType, videoId, preferredLang);

  if (subtitleResult.segments.length === 0) {
    return {
      segments: [],
      source: "failed",
      subtitleType: "none",
      aiEnhanced: false,
      fromCache: false,
      error: "No subtitles available for this video.",
    };
  }

  // ─── Level 2: AI enhancement ──────────────────────────────────────────────
  const enhanced = await enhanceWithAI(subtitleResult.segments);

  if (enhanced.enhanced) {
    writeTranscriptCache(videoId, preferredLang, "subtitle-enhanced", enhanced.segments);
    return {
      segments: enhanced.segments,
      source: "subtitle-enhanced",
      subtitleType: subtitleResult.source as "manual" | "auto-generated",
      aiEnhanced: true,
      fromCache: false,
    };
  }

  // AI unavailable — cache raw subtitles to avoid re-fetching from YouTube
  writeTranscriptCache(videoId, preferredLang, "subtitle-raw", subtitleResult.segments);
  return {
    segments: subtitleResult.segments,
    source: "subtitle-raw",
    subtitleType: subtitleResult.source as "manual" | "auto-generated",
    aiEnhanced: false,
    fromCache: false,
    error: enhanced.error,
  };
}
