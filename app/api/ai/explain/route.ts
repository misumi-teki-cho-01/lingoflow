import { NextResponse } from 'next/server';
import { explainTextVocabulary } from '@/lib/ai/services';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Internal server error';
}

export async function POST(request: Request) {
  try {
    const { text, wordsToExplain, locale = 'zh' } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    if (!Array.isArray(wordsToExplain) || wordsToExplain.length === 0) {
      return NextResponse.json(
        { error: 'wordsToExplain array is required and must not be empty' },
        { status: 400 },
      );
    }

    const definitions = await explainTextVocabulary(text, wordsToExplain, locale);
    return NextResponse.json({ definitions });
  } catch (error) {
    const message = getErrorMessage(error);
    console.error('[Explain API] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
