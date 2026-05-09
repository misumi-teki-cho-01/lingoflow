import { NextResponse } from 'next/server';
import { getTranscriptByVideoExtId, upsertTranscript } from '@/lib/db/transcripts';
import type { TranscriptSegment } from '@/types/transcript';

function isValidSegment(segment: TranscriptSegment): boolean {
  return (
    typeof segment.start_time === 'number' &&
    typeof segment.end_time === 'number' &&
    typeof segment.text === 'string' &&
    segment.text.trim().length > 0 &&
    segment.end_time > segment.start_time
  );
}

export async function POST(request: Request) {
  try {
    const { videoId, segments, language } = (await request.json()) as {
      videoId?: string;
      segments?: TranscriptSegment[];
      language?: string;
    };

    if (!videoId || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'videoId and segments array are required' },
        { status: 400 },
      );
    }

    if (!segments.every(isValidSegment)) {
      return NextResponse.json(
        {
          error: 'Each segment must have start_time, end_time, and text',
        },
        { status: 400 },
      );
    }

    const normalized = segments
      .map((segment) => ({
        start_time: segment.start_time,
        end_time: segment.end_time,
        text: segment.text.trim(),
      }))
      .sort((a, b) => a.start_time - b.start_time);

    const lang = language || 'en';
    const existing = await getTranscriptByVideoExtId(videoId, lang);
    await upsertTranscript(videoId, lang, 'subtitle-raw', normalized, existing?.transcriptId);

    return NextResponse.json({ success: true, segmentCount: normalized.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Transcript Upload API] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
