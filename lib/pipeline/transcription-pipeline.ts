import type { TranscriptSegment } from "@/types/transcript";
import type { VideoSourceType } from "@/types/video";
import { fetchSubtitles } from "@/lib/services/subtitle-fetcher";
import { enhanceSubtitlesForLearners } from "@/lib/ai/services";

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
  error?: string;
}

/**
 * Two-level transcription pipeline (DB agnostic).
 *
 * Pipeline levels:
 *   Level 1: Fetch subtitles from YouTube (fast, free)
 *   Level 2: AI enhancement via Gemini (low cost, text tokens only)
 *   Level 3: No subtitles -> return "failed" (audio not implemented yet)
 */
export async function runTranscriptionPipeline(
  sourceType: VideoSourceType,
  videoId: string,
  preferredLang: string = "en",
  initialState?: { segments: TranscriptSegment[]; quality: TranscriptSource }
): Promise<PipelineResult> {

  // If we already have raw subtitles (e.g. from previous run or cache), we just try to upgrade them
  if (initialState?.quality === "subtitle-raw") {
    const enhanced = await enhanceSubtitlesForLearners(initialState.segments);
    if (enhanced.enhanced) {
      return {
        segments: enhanced.segments,
        source: "subtitle-enhanced",
        subtitleType: "auto-generated",
        aiEnhanced: true,
      };
    }
    // Optimization failed or unavailable, fallback to what we already had
    return {
      segments: initialState.segments,
      source: "subtitle-raw",
      subtitleType: "auto-generated", // Assume auto-generated since we don't know the exact original source here
      aiEnhanced: false,
    };
  }

  // ─── Level 1: Fetch subtitles ─────────────────────────────────────────────
  const subtitleResult = await fetchSubtitles(sourceType, videoId, preferredLang);

  if (subtitleResult.segments.length === 0) {
    return {
      segments: [],
      source: "failed",
      subtitleType: "none",
      aiEnhanced: false,
      error: "No subtitles available for this video.",
    };
  }

  // ─── Level 2: AI enhancement ──────────────────────────────────────────────
  const enhanced = await enhanceSubtitlesForLearners(subtitleResult.segments);

  if (enhanced.enhanced) {
    return {
      segments: enhanced.segments,
      source: "subtitle-enhanced",
      subtitleType: subtitleResult.source as "manual" | "auto-generated",
      aiEnhanced: true,
    };
  }

  // AI unavailable — return raw subtitles
  return {
    segments: subtitleResult.segments,
    source: "subtitle-raw",
    subtitleType: subtitleResult.source as "manual" | "auto-generated",
    aiEnhanced: false,
    error: enhanced.error,
  };
}
