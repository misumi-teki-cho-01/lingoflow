import type { TranscriptSegment } from "@/types/transcript";
import { getGeminiClient } from "@/lib/gemini/client";

/**
 * AI enhancement result — contains improved segments and optional analysis metadata.
 */
export interface EnhancementResult {
  segments: TranscriptSegment[];
  enhanced: boolean;
  error?: string;
}

const ENHANCEMENT_PROMPT = `You are a language learning assistant. I'll give you a transcript from a video with timestamps. Please improve it for English learners:

1. Fix punctuation, capitalization, and spelling errors
2. Merge fragments that belong to the same sentence (keep the earliest start_time and latest end_time)
3. Split run-on sentences into natural speech units (one complete thought per segment)
4. Remove filler annotations like [Music], [Applause] unless they provide context
5. Preserve the original meaning exactly — do not paraphrase

Return ONLY a JSON array with this exact format, no markdown fencing:
[{"start_time": 0.0, "end_time": 2.5, "text": "Hello and welcome."}]

Rules:
- Timestamps in seconds (float)
- Ensure no gaps: each end_time should equal the next start_time
- Ensure monotonically increasing timestamps
- Return valid JSON only`;

/**
 * Use Gemini to enhance raw subtitle segments.
 * Merges fragments, fixes punctuation, improves sentence boundaries.
 *
 * If Gemini is unavailable, returns original segments with enhanced=false.
 */
export async function enhanceWithAI(
  segments: TranscriptSegment[],
): Promise<EnhancementResult> {
  if (segments.length === 0) {
    return { segments: [], enhanced: false };
  }

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Format segments as input for Gemini
    const input = JSON.stringify(
      segments.map((s) => ({
        start_time: s.start_time,
        end_time: s.end_time,
        text: s.text,
      })),
    );

    const result = await model.generateContent([
      ENHANCEMENT_PROMPT,
      `\nTranscript:\n${input}`,
    ]);

    const responseText = result.response.text().trim();

    // Parse the JSON response — strip markdown fencing if present
    const jsonStr = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const enhanced = JSON.parse(jsonStr) as TranscriptSegment[];

    // Validate the response
    if (!Array.isArray(enhanced) || enhanced.length === 0) {
      return { segments, enhanced: false, error: "Empty AI response" };
    }

    // Validate each segment has required fields
    const isValid = enhanced.every(
      (s) =>
        typeof s.start_time === "number" &&
        typeof s.end_time === "number" &&
        typeof s.text === "string" &&
        s.text.length > 0,
    );

    if (!isValid) {
      return { segments, enhanced: false, error: "Invalid AI response format" };
    }

    return { segments: enhanced, enhanced: true };
  } catch (error) {
    // AI unavailable — gracefully degrade to raw subtitles
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI Enhancer] Failed, using raw subtitles:", message);
    return { segments, enhanced: false, error: message };
  }
}
