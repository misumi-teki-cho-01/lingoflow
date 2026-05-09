import { createClient } from '@/lib/supabase/server';

export interface VideoInsertData {
  url: string;
  source_type: 'youtube' | 'bilibili';
  video_ext_id: string;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  duration?: number | null;
  language?: string;
}

/**
 * Check if a video with the given external ID exists in the database.
 */
export async function getVideoByExtId(videoExtId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('video_ext_id', videoExtId)
      .single();
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch a page of recently imported videos for the dashboard.
 * Uses closed-interval range so the query is compatible with Supabase RLS.
 */
export async function getRecentVideos(limit: number = 24, offset: number = 0) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('videos')
      .select('video_ext_id, title, channel_name, thumbnail_url, duration, source_type, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Insert a new video record into the database. Returns the newly created DB item details.
 */
export async function insertVideo(videoData: VideoInsertData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('videos')
    .insert({
      url: videoData.url,
      source_type: videoData.source_type,
      video_ext_id: videoData.video_ext_id,
      title: videoData.title,
      channel_name: videoData.channel_name,
      thumbnail_url: videoData.thumbnail_url,
      duration: videoData.duration ?? null,
      language: videoData.language || 'en',
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }
  return data;
}
