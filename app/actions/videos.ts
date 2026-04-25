"use server";

import { getRecentVideos } from "@/lib/db/videos";
import type { VideoCardData } from "@/components/video/video-card";

/**
 * Server Action: fetch the next page of dashboard videos.
 * Called from the client "Load more" button.
 */
export async function fetchVideosPage(
  offset: number,
  limit: number = 24
): Promise<VideoCardData[]> {
  const data = await getRecentVideos(limit, offset);
  return data as VideoCardData[];
}
