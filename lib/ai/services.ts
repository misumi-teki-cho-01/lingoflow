import type { TranscriptSegment } from '@/types/transcript';
import { generateAIText, getGemini2_0FlashModel } from './client';
import { getEnhancementPrompt, getExplainDictationPrompt } from './prompts';

export interface EnhancementResult {
  segments: TranscriptSegment[];
  enhanced: boolean;
  error?: string;
}

// ── Grouping format helpers ──────────────────────────────────────────────

export interface Grouping {
  ids: number[];
  text: string;
}

const ENHANCE_CHUNK_SIZE = 200;
// When picking a chunk boundary, look back at most this many segments for a
// sentence-ending punctuation mark before falling back to a hard cut.
const BOUNDARY_LOOKBACK = 8;
const SENTENCE_END_RE = /[.!?。！？]["'""」』）)\]]?\s*$/;

/**
 * Split segments into chunks of ~ENHANCE_CHUNK_SIZE, preferring boundaries
 * where the last segment ends with sentence-ending punctuation so we don't
 * cut a sentence in half across chunks.
 */
export function chunkSegmentsForEnhancement(
  segments: TranscriptSegment[],
  chunkSize: number = ENHANCE_CHUNK_SIZE,
): TranscriptSegment[][] {
  if (segments.length <= chunkSize) return [segments];

  const chunks: TranscriptSegment[][] = [];
  let start = 0;
  while (start < segments.length) {
    let end = Math.min(start + chunkSize, segments.length);
    if (end < segments.length) {
      // Look back from the proposed cut for a sentence-ending segment.
      for (let i = 0; i < BOUNDARY_LOOKBACK; i++) {
        const probe = end - 1 - i;
        if (probe <= start) break;
        if (SENTENCE_END_RE.test(segments[probe].text)) {
          end = probe + 1;
          break;
        }
      }
    }
    chunks.push(segments.slice(start, end));
    start = end;
  }
  return chunks;
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

/**
 * Parse the AI grouping response and reconstruct TranscriptSegments using
 * timestamps from the original input segments (referenced by id).
 *
 * Validation rules:
 *  - Output is a non-empty array of {ids: number[], text: string}
 *  - Every id referenced must exist in the source chunk
 *  - No id may appear in more than one group (duplicates rejected)
 *  - Segments dropped by the AI (e.g. [Music]) are allowed — they simply
 *    don't appear in any group.
 */
export function reconstructSegmentsFromGroupings(
  sourceSegments: TranscriptSegment[],
  responseText: string,
): { ok: true; segments: TranscriptSegment[] } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(responseText));
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, error: 'Empty or non-array response' };
  }

  const byId = new Map<number, TranscriptSegment>();
  sourceSegments.forEach((s, idx) => byId.set(idx + 1, s));

  const seenIds = new Set<number>();
  const out: TranscriptSegment[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Group item is not an object' };
    }
    const { ids, text } = item as { ids?: unknown; text?: unknown };
    if (!Array.isArray(ids) || ids.length === 0) {
      return { ok: false, error: 'Group ids must be a non-empty array' };
    }
    if (typeof text !== 'string' || text.length === 0) {
      return { ok: false, error: 'Group text must be a non-empty string' };
    }

    const refs: TranscriptSegment[] = [];
    for (const id of ids) {
      if (typeof id !== 'number' || !Number.isInteger(id)) {
        return { ok: false, error: `Non-integer id: ${String(id)}` };
      }
      if (seenIds.has(id)) {
        return { ok: false, error: `Duplicate id: ${id}` };
      }
      const src = byId.get(id);
      if (!src) {
        return { ok: false, error: `Unknown id: ${id}` };
      }
      seenIds.add(id);
      refs.push(src);
    }

    const start_time = Math.min(...refs.map((r) => r.start_time));
    const end_time = Math.max(...refs.map((r) => r.end_time));
    out.push({ start_time, end_time, text });
  }

  return { ok: true, segments: out };
}

function buildChunkPrompt(chunk: TranscriptSegment[], locale: string): string {
  const numbered = chunk.map((s, idx) => ({ id: idx + 1, text: s.text }));
  return `${getEnhancementPrompt(locale)}\n\nTranscript:\n${JSON.stringify(numbered, null, 2)}`;
}

/**
 * Business Service: Enhance raw subtitles for language learners using AI.
 *
 * The AI only decides sentence grouping & text cleanup. Timestamps are
 * reconstructed deterministically in code from the referenced source IDs.
 * For long inputs, segments are split into chunks (with sentence-aware
 * boundaries) and processed sequentially.
 */
const ENHANCE_CONCURRENCY = 5;

/**
 * Run an async fn over items with bounded concurrency. Preserves input order
 * in the result. If any worker throws, in-flight tasks finish but no new ones
 * start, then the rejection propagates.
 */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let aborted = false;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!aborted) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        aborted = true;
        throw err;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export async function enhanceSubtitlesForLearners(
  segments: TranscriptSegment[],
  locale: string = 'en',
  modelId?: string,
): Promise<EnhancementResult> {
  if (segments.length === 0) {
    return { segments: [], enhanced: false };
  }

  try {
    const chunks = chunkSegmentsForEnhancement(segments);
    const t0 = Date.now();
    console.log(
      `[AI Service: Enhance] Starting ${chunks.length} chunk(s) with concurrency ${ENHANCE_CONCURRENCY}`,
    );

    const enhancedChunks = await runWithConcurrency(
      chunks,
      ENHANCE_CONCURRENCY,
      async (chunk, i) => {
        const cT0 = Date.now();
        const prompt = buildChunkPrompt(chunk, locale);
        const responseText = await generateAIText(prompt, { modelId });
        const parsed = reconstructSegmentsFromGroupings(chunk, responseText);
        if (!parsed.ok) {
          console.error(
            `[AI Service: Enhance] Chunk ${i + 1}/${chunks.length} failed in ${Date.now() - cT0}ms: ${parsed.error}`,
          );
          throw new Error(parsed.error);
        }
        console.log(
          `[AI Service: Enhance] Chunk ${i + 1}/${chunks.length} done in ${Date.now() - cT0}ms (${chunk.length} → ${parsed.segments.length})`,
        );
        return parsed.segments;
      },
    );

    console.log(
      `[AI Service: Enhance] All chunks done in ${Date.now() - t0}ms`,
    );
    return { segments: enhancedChunks.flat(), enhanced: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Service: Enhance] Failed:', message);
    return { segments, enhanced: false, error: message };
  }
}

export interface VocabularyExplanation {
  original_text: string;
  canonical_form: string;
  explanation: string;
}

/**
 * Business Service: Explain highlighted vocabulary in dictation texts.
 */
export async function explainTextVocabulary(
  text: string,
  wordsToExplain: string[],
  locale: string = 'zh',
): Promise<Record<string, VocabularyExplanation>> {
  if (!text || wordsToExplain.length === 0) return {};

  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn('[AI Service: Explain] Skipping explanation because GEMINI_API_KEY is not set.');
      return {};
    }

    const promptTemplate = getExplainDictationPrompt(locale);
    const prompt = promptTemplate
      .replace('{{text}}', text)
      .replace('{{words}}', JSON.stringify(wordsToExplain, null, 2));

    const model = getGemini2_0FlashModel();
    const result = await model.generateContent(prompt);

    const responseText = result.response.text();
    const cleanJsonStr = responseText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    return JSON.parse(cleanJsonStr);
  } catch (error) {
    console.error('[AI Service: Explain] Failed:', error);
    return {};
  }
}
