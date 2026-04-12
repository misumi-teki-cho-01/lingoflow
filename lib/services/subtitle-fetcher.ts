import { YoutubeTranscript, type TranscriptResponse } from "youtube-transcript";
import type { TranscriptSegment } from "@/types/transcript";
import type { VideoSourceType } from "@/types/video";

export interface SubtitleFetchResult {
  segments: TranscriptSegment[];
  source: "manual" | "auto-generated" | "none";
  language: string;
}

/**
 * Convert youtube-transcript raw response to our TranscriptSegment format.
 * Raw format: { text, offset (ms), duration (ms) }
 * Our format: { text, start_time (s), end_time (s) }
 */
function toSegments(raw: TranscriptResponse[]): TranscriptSegment[] {
  return raw
    .filter((item) => item.text.trim().length > 0)
    .map((item) => ({
      text: decodeHtmlEntities(item.text.trim()),
      start_time: item.offset / 1000,
      end_time: (item.offset + item.duration) / 1000,
    }));
}

/**
 * Decode common HTML entities that YouTube transcripts may contain.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n/g, " ");
}

/**
 * Fetch existing subtitles from a YouTube video.
 * Tries manual subtitles first (higher quality), then auto-generated.
 */
export async function fetchYouTubeSubtitles(
  videoId: string,
  preferredLang: string = "en",
): Promise<SubtitleFetchResult> {
  // Attempt 1: Fetch manual subtitles in preferred language
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: preferredLang,
    });

    if (transcript.length > 0) {
      return {
        segments: toSegments(transcript),
        source: transcript[0].lang ? "manual" : "auto-generated",
        language: preferredLang,
      };
    }
  } catch {
    // Manual subtitles not available, try auto-generated
  }

  // Attempt 2: Fetch any available transcript (auto-generated fallback)
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);

    if (transcript.length > 0) {
      return {
        segments: toSegments(transcript),
        source: "auto-generated",
        language: "en",
      };
    }
  } catch {
    // No subtitles available at all
  }

  return { segments: [], source: "none", language: preferredLang };
}

/**
 * Fetch subtitles based on video source type.
 * Bilibili support to be added in Phase 5.
 */
export async function fetchSubtitles(
  sourceType: VideoSourceType,
  videoId: string,
  preferredLang: string = "en",
): Promise<SubtitleFetchResult> {
  switch (sourceType) {
    case "youtube":
      return fetchYouTubeSubtitles(videoId, preferredLang);
    case "bilibili":
      // TODO: Phase 5 — Bilibili subtitle extraction
      return { segments: [], source: "none", language: preferredLang };
    default:
      return { segments: [], source: "none", language: preferredLang };
  }
}
