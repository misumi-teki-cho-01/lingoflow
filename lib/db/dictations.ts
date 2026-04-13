import type { TranscriptSegment } from "@/types/transcript";
import { getDbAccess } from "@/lib/supabase/access";

export interface UserDictation {
  id: string;
  content_html: string | null;
  content_text: string | null;
  segments: TranscriptSegment[];
}

export interface SaveUserDictationInput {
  videoExtId: string;
  language?: string;
  contentHtml: string;
  segments: TranscriptSegment[];
}

export async function getUserDictationByVideoId(
  videoId: string,
  language = "en"
): Promise<UserDictation | null> {
  const access = await getDbAccess();
  if (!access?.userId) return null;

  const { db, userId } = access;
  const { data, error } = await db
    .from("user_dictations")
    .select("id, content_html, content_text, segments")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .eq("language", language)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[DB: Dictation] Failed to fetch user dictation:", error);
    }
    return null;
  }

  return {
    id: data.id,
    content_html: data.content_html,
    content_text: data.content_text,
    segments: data.segments as TranscriptSegment[],
  };
}

export async function saveUserDictation(input: SaveUserDictationInput): Promise<void> {
  const access = await getDbAccess();
  if (!access?.userId) {
    console.warn(
      "[DB: Dictation] Skipping save because there is no authenticated user. " +
      "Set DEV_SUPABASE_USER_ID and SUPABASE_SERVICE_ROLE_KEY for development-only persistence."
    );
    return;
  }

  const { db, userId } = access;
  const language = input.language ?? "en";

  const { data: video, error: videoErr } = await db
    .from("videos")
    .select("id, transcripts(id)")
    .eq("video_ext_id", input.videoExtId)
    .single();

  if (videoErr || !video?.id) {
    console.error("[DB: Dictation] Failed to find video for dictation save:", videoErr);
    return;
  }

  const sourceTranscriptId =
    Array.isArray(video.transcripts) && video.transcripts.length > 0
      ? video.transcripts[0].id
      : null;

  const contentText = input.segments.map((segment) => segment.text).join("\n").trim();

  const { error } = await db.from("user_dictations").upsert(
    {
      user_id: userId,
      video_id: video.id,
      source_transcript_id: sourceTranscriptId,
      language,
      content_html: input.contentHtml,
      content_text: contentText,
      segments: input.segments,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,video_id,language" }
  );

  if (error) {
    console.error("[DB: Dictation] Failed to upsert user dictation:", error);
  }
}
