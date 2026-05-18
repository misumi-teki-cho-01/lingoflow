import 'server-only';

import { notFound, redirect } from 'next/navigation';
import { runTranscriptionPipeline } from '@/lib/pipeline/transcription-pipeline';
import { fetchVideoMeta, type VideoMeta } from '@/lib/utils/video-meta';
import { createClient } from '@/lib/supabase/server';
import { getUserDictationByVideoId } from '@/lib/db/dictations';
import {
  getSavedCcSelectionsForTranscript,
  getSavedVocabularyForTranscript,
} from '@/lib/db/vocabulary';
import type { VocabularyExplanation } from '@/lib/ai/services';
import type { TranscriptSource } from '@/lib/pipeline/transcription-pipeline';
import type { CcSelection, TranscriptSegment } from '@/types/transcript';
import type { VideoSourceType } from '@/types/video';

const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const BILI_BV_RE = /^BV[a-zA-Z0-9]+$/;
const LOCAL_ID_RE = /^local-[a-f0-9-]+$/i;

interface DBVideo {
  id: string;
  url: string;
  source_type: VideoSourceType;
  title: string | null;
  channel_name: string | null;
  thumbnail_url: string | null;
  duration: number | null;
}

interface DBTranscript {
  id: string;
  segments: TranscriptSegment[];
  quality: TranscriptSource;
}

interface StudyVideoData {
  videoMeta: VideoMeta;
  videoUrl: string;
  segments: TranscriptSegment[];
  transcriptSource: TranscriptSource;
  definitions: Record<string, VocabularyExplanation>;
  ccSelections: CcSelection[];
  dictationHtml: string | null;
}

async function getVideoFromDB(videoExtId: string): Promise<{
  video: DBVideo | null;
  transcript: DBTranscript | null;
  definitions: Record<string, VocabularyExplanation>;
  ccSelections: CcSelection[];
  dictationHtml: string | null;
}> {
  try {
    const supabase = await createClient();

    const { data: video } = await supabase
      .from('videos')
      .select('id, url, source_type, title, channel_name, thumbnail_url, duration')
      .eq('video_ext_id', videoExtId)
      .single();

    if (!video) {
      return {
        video: null,
        transcript: null,
        definitions: {},
        ccSelections: [],
        dictationHtml: null,
      };
    }

    const { data: transcript } = await supabase
      .from('transcripts')
      .select('id, segments, quality')
      .eq('video_id', video.id)
      .eq('language', 'en')
      .eq('status', 'completed')
      .single();

    const definitions = transcript ? await getSavedVocabularyForTranscript(transcript.id) : {};
    const ccSelections = transcript ? await getSavedCcSelectionsForTranscript(transcript.id) : [];
    const dictation = await getUserDictationByVideoId(video.id, 'en');

    return {
      video,
      definitions,
      ccSelections,
      dictationHtml: dictation?.content_html ?? null,
      transcript: transcript
        ? {
            id: transcript.id,
            segments: transcript.segments as TranscriptSegment[],
            quality: transcript.quality as TranscriptSource,
          }
        : null,
    };
  } catch {
    return {
      video: null,
      transcript: null,
      definitions: {},
      ccSelections: [],
      dictationHtml: null,
    };
  }
}

function inferVideoSource(id: string): VideoSourceType | null {
  if (YT_ID_RE.test(id)) return 'youtube';
  if (BILI_BV_RE.test(id)) return 'bilibili';
  if (LOCAL_ID_RE.test(id)) return 'local';
  return null;
}

export async function loadStudyVideoData(id: string, locale: string): Promise<StudyVideoData> {
  const inferredSource = inferVideoSource(id);

  if (!inferredSource) notFound();

  const {
    video: dbVideo,
    transcript: dbTranscript,
    definitions,
    ccSelections,
    dictationHtml,
  } = await getVideoFromDB(id);

  const sourceType = dbVideo?.source_type ?? inferredSource;

  if (dbVideo) {
    return {
      definitions,
      ccSelections,
      dictationHtml,
      videoMeta: {
        title: dbVideo.title ?? '',
        channelName: dbVideo.channel_name ?? '',
        thumbnailUrl: dbVideo.thumbnail_url ?? '',
        duration: dbVideo.duration ?? undefined,
      },
      videoUrl: dbVideo.url,
      segments: dbTranscript?.segments ?? [],
      transcriptSource: dbTranscript?.quality ?? 'failed',
    };
  }

  if (sourceType === 'local') {
    notFound();
  }

  const [videoMeta, result] = await Promise.all([
    fetchVideoMeta(sourceType, id),
    runTranscriptionPipeline(sourceType, id, 'en'),
  ]);

  if (result.source === 'failed' || result.segments.length === 0) {
    redirect(`/${locale}/dashboard?error=no-subtitles&video=${id}`);
  }

  return {
    videoMeta,
    videoUrl:
      sourceType === 'bilibili'
        ? `https://www.bilibili.com/video/${id}`
        : `https://www.youtube.com/watch?v=${id}`,
    segments: result.segments,
    transcriptSource: result.source,
    definitions,
    ccSelections,
    dictationHtml,
  };
}
