import type { TranscriptSegment } from "@/types/transcript";

export async function saveEnhancedTranscript(
  videoId: string,
  segments: TranscriptSegment[]
): Promise<void> {
  const res = await fetch("/api/transcripts/enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, segments }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to save enhanced transcript");
}
