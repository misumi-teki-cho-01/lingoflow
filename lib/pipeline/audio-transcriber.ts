import type { TranscriptSegment } from "@/types/transcript";
import { getGeminiClient } from "@/lib/gemini/client";

/**
 * Level 3 fallback: Full audio transcription via Gemini.
 * Only used when no subtitles are available at all.
 *
 * This requires the audio file to be provided as base64 or a URL.
 * For MVP, this is a placeholder — full implementation requires
 * yt-dlp audio extraction which needs a self-hosted server with
 * yt-dlp + ffmpeg binaries.
 */

const TRANSCRIPTION_PROMPT = `Transcribe this audio with precise timestamps. Return a JSON array where each element represents one sentence or natural speech unit.

Format:
[{"start_time": 0.0, "end_time": 2.5, "text": "Hello and welcome to today's lesson."}]

Rules:
- Timestamps in seconds (float, one decimal)
- Each segment should be one complete sentence or natural pause unit
- Preserve original punctuation and capitalization
- Include filler words (um, uh) for shadowing accuracy
- Ensure no gaps between segments
- Return ONLY the JSON array, no markdown formatting`;

export interface AudioTranscriptionResult {
  segments: TranscriptSegment[];
  success: boolean;
  error?: string;
}

/**
 * Transcribe audio using Gemini's audio understanding capabilities.
 * Accepts base64-encoded audio data.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = "audio/mp3",
): Promise<AudioTranscriptionResult> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      },
      TRANSCRIPTION_PROMPT,
    ]);

    const responseText = result.response.text().trim();
    const jsonStr = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const segments = JSON.parse(jsonStr) as TranscriptSegment[];

    if (!Array.isArray(segments) || segments.length === 0) {
      return { segments: [], success: false, error: "Empty transcription result" };
    }

    return { segments, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { segments: [], success: false, error: message };
  }
}
