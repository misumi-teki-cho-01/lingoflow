import type { TranscriptSegment } from "@/types/transcript";
import type { VocabularyExplanation } from "@/lib/ai/services";

export async function fetchAIExplanations(mdText: string, wordsToExplain: string[], locale: string): Promise<Record<string, VocabularyExplanation>> {
  const res = await fetch("/api/ai/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: mdText, wordsToExplain, locale })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch AI definitions");

  return data.definitions || {};
}

export async function saveVocabularyToDB(
  videoId: string,
  definitions: Record<string, VocabularyExplanation>,
  options?: {
    dictation?: {
      contentHtml: string;
      segments: TranscriptSegment[];
    };
  }
): Promise<void> {
  const res = await fetch("/api/vocabulary/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId,
      definitions,
      dictation: options?.dictation ?? null,
    })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to save vocabulary");
}
