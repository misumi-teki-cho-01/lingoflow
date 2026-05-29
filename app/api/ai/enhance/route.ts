import { NextResponse } from 'next/server';
import { enhanceSubtitlesForLearners } from '@/lib/ai/services';
import type { TranscriptSegment } from '@/types/transcript';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Internal server error';
}

export async function POST(request: Request) {
  try {
    const {
      segments,
      locale = 'en',
      modelId,
    } = (await request.json()) as {
      segments?: TranscriptSegment[];
      locale?: string;
      modelId?: string;
    };

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'segments array is required and must not be empty' },
        { status: 400 },
      );
    }

    const result = await enhanceSubtitlesForLearners(segments, locale, modelId);

    if (!result.enhanced) {
      return NextResponse.json({ error: result.error ?? 'AI enhancement failed' }, { status: 502 });
    }

    return NextResponse.json({ segments: result.segments });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[Enhance API] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
