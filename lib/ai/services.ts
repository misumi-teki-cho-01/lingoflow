import type { TranscriptSegment } from "@/types/transcript";
import { getGemini2_0FlashModel } from "./client";
import { ENHANCEMENT_PROMPT, EXPLAIN_DICTATION_PROMPT } from "./prompts";

export interface EnhancementResult {
  segments: TranscriptSegment[];
  enhanced: boolean;
  error?: string;
}

/**
 * Business Service: Enhance raw subtitles for language learners using AI.
 * Handles merging, punctuation, and sentence segmentation.
 */
export async function enhanceSubtitlesForLearners(
  segments: TranscriptSegment[],
): Promise<EnhancementResult> {
  if (segments.length === 0) {
    return { segments: [], enhanced: false };
  }

  try {
    const input = JSON.stringify(
      segments.map((s) => ({
        start_time: s.start_time,
        end_time: s.end_time,
        text: s.text,
      })),
    );

    const model = getGemini2_0FlashModel();
    const result = await model.generateContent([
      ENHANCEMENT_PROMPT,
      `\nTranscript:\n${input}`,
    ]);

    const responseText = result.response.text();

    // Parse the JSON response
    const jsonStr = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const enhanced = JSON.parse(jsonStr) as TranscriptSegment[];

    // Strict validation
    if (!Array.isArray(enhanced) || enhanced.length === 0) {
      return { segments, enhanced: false, error: "Empty AI response" };
    }

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
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[AI Service: Enhance] Failed:", message);
    return { segments, enhanced: false, error: message };
  }
}

/**
 * Business Service: Explain highlighted vocabulary in dictation texts.
 */
export async function explainTextVocabulary(
  text: string,
  locale: string = "zh"
): Promise<Record<string, string>> {
  if (!text) return {};

  try {
    const prompt = EXPLAIN_DICTATION_PROMPT
      .replace("{{locale}}", locale)
      .replace("{{text}}", text);

    const model = getGemini2_0FlashModel();
    const result = await model.generateContent(prompt);
    
    const responseText = result.response.text();
    const cleanJsonStr = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    
    return JSON.parse(cleanJsonStr);
  } catch (error) {
    console.error("[AI Service: Explain] Failed:", error);
    throw new Error("Failed to parse AI output into JSON.");
  }
}
