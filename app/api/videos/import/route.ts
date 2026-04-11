import { NextResponse } from "next/server";
import { detectVideoSource } from "@/lib/video-providers";
import { runTranscriptionPipeline } from "@/lib/pipeline/transcription-pipeline";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 },
      );
    }

    const parsed = detectVideoSource(url);
    if (!parsed) {
      return NextResponse.json(
        { error: "Unsupported video URL. Please provide a YouTube or Bilibili link." },
        { status: 400 },
      );
    }

    // Run the 3-level transcription pipeline:
    // Level 1: Fetch existing subtitles/CC (fast, free)
    // Level 2: AI enhancement via Gemini (fast, low cost)
    // Level 3: Audio transcription fallback (slow, high cost)
    const result = await runTranscriptionPipeline(
      parsed.source,
      parsed.videoId,
    );

    // TODO: Store video + transcript in Supabase when auth is configured.
    // For now, return the pipeline result directly.

    return NextResponse.json(
      {
        videoId: parsed.videoId,
        source: parsed.source,
        transcript: {
          segments: result.segments,
          source: result.source,
          subtitleType: result.subtitleType,
          aiEnhanced: result.aiEnhanced,
          segmentCount: result.segments.length,
          error: result.error,
        },
      },
      { status: result.segments.length > 0 ? 200 : 422 },
    );
  } catch (error) {
    console.error("[Video Import]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
