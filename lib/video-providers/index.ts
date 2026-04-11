import type { VideoSourceType, VideoProvider } from "@/types/video";
import { YouTubeProvider } from "./youtube-provider";
import { BilibiliProvider } from "./bilibili-provider";

export function createVideoProvider(source: VideoSourceType): VideoProvider {
  switch (source) {
    case "youtube":
      return new YouTubeProvider();
    case "bilibili":
      return new BilibiliProvider();
    default:
      throw new Error(`Unsupported video source: ${source}`);
  }
}

export function detectVideoSource(
  url: string,
): { source: VideoSourceType; videoId: string } | null {
  // YouTube patterns
  const ytPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of ytPatterns) {
    const match = url.match(pattern);
    if (match) {
      return { source: "youtube", videoId: match[1] };
    }
  }

  // Bilibili patterns
  const biliPattern = /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/;
  const biliMatch = url.match(biliPattern);
  if (biliMatch) {
    return { source: "bilibili", videoId: biliMatch[1] };
  }

  return null;
}
