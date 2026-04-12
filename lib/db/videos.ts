import { createClient } from "@/lib/supabase/server";

export interface VideoInsertData {
  url: string;
  source_type: "youtube" | "bilibili";
  video_ext_id: string;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  language?: string;
}

/**
 * Check if a video with the given external ID exists in the database.
 */
export async function getVideoByExtId(videoExtId: string) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("videos")
      .select("*")
      .eq("video_ext_id", videoExtId)
      .single();
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch the most recently imported videos for the dashboard.
 */
export async function getRecentVideos(limit: number = 50) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("videos")
      .select("video_ext_id, title, channel_name, thumbnail_url, duration, source_type")
      .order("created_at", { ascending: false })
      .limit(limit);
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
    .from("videos")
    .insert({
      url: videoData.url,
      source_type: videoData.source_type,
      video_ext_id: videoData.video_ext_id,
      title: videoData.title,
      channel_name: videoData.channel_name,
      thumbnail_url: videoData.thumbnail_url,
      language: videoData.language || "en",
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  return data;
}
