'use server';

import { revalidatePath } from 'next/cache';
import { deleteVideoById, getRecentVideos } from '@/lib/db/videos';
import type { VideoCardData } from '@/components/video/video-card';

/**
 * Server Action: fetch the next page of dashboard videos.
 * Called from the client "Load more" button.
 */
export async function fetchVideosPage(
  offset: number,
  limit: number = 24,
): Promise<VideoCardData[]> {
  const data = await getRecentVideos(limit, offset);
  return data as VideoCardData[];
}

export interface DeleteVideoResult {
  ok: boolean;
  error?: string;
}

/**
 * Server Action: delete a dashboard video and its dependent records.
 */
export async function deleteVideo(videoId: string): Promise<DeleteVideoResult> {
  if (!videoId) {
    return {
      ok: false,
      error: 'Missing video id',
    };
  }

  try {
    await deleteVideoById(videoId);
    revalidatePath('/[locale]/dashboard', 'page');
    return { ok: true };
  } catch (error) {
    console.error('[Videos] Failed to delete video:', error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to delete video',
    };
  }
}
