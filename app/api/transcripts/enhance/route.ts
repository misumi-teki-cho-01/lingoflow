import { NextResponse } from "next/server";
import { upsertTranscript, getTranscriptByVideoExtId } from "@/lib/db/transcripts";
import type { TranscriptSegment } from "@/types/transcript";

export async function POST(request: Request) {
  try {
    const { videoId, segments } = await request.json() as {
      videoId: string;
      segments: TranscriptSegment[];
    };

    if (!videoId || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: "videoId and segments array are required" },
        { status: 400 }
      );
    }

    // Validate segment shape
    const isValid = segments.every(
      (s) =>
        typeof s.start_time === "number" &&
        typeof s.end_time === "number" &&
        typeof s.text === "string" &&
        s.text.length > 0
    );
    if (!isValid) {
      return NextResponse.json(
        { error: "Each segment must have start_time (number), end_time (number), and text (string)" },
        { status: 400 }
      );
    }

    // Fetch existing transcript ID so we can update in-place rather than insert
    const existing = await getTranscriptByVideoExtId(videoId, "en");

    await upsertTranscript(
      videoId,
      "en",
      "subtitle-enhanced",
      segments,
      existing?.transcriptId
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[Transcript Enhance API] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
