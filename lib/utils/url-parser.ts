import type { VideoSourceType } from "@/types/video";

export interface ParsedVideoUrl {
  source: VideoSourceType;
  videoId: string;
  url: string;
}

/**
 * Parse and validate a video URL.
 * Returns parsed info or null if the URL is not a supported video platform.
 */
export function parseVideoUrl(url: string): ParsedVideoUrl | null {
  try {
    const trimmed = url.trim();
    if (!trimmed) return null;

    // Ensure it's a valid URL
    new URL(trimmed);

    // YouTube patterns
    const ytPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of ytPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return { source: "youtube", videoId: match[1], url: trimmed };
      }
    }

    // Bilibili patterns
    const biliPattern = /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/;
    const biliMatch = trimmed.match(biliPattern);
    if (biliMatch) {
      return { source: "bilibili", videoId: biliMatch[1], url: trimmed };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get YouTube thumbnail URL from video ID.
 */
export function getYouTubeThumbnail(
  videoId: string,
  quality: "default" | "medium" | "high" | "maxres" = "high",
): string {
  const qualityMap = {
    default: "default",
    medium: "mqdefault",
    high: "hqdefault",
    maxres: "maxresdefault",
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}
