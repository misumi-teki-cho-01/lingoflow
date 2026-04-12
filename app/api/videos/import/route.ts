import { NextResponse } from "next/server";
import { detectVideoSource } from "@/lib/video-providers";
import { runTranscriptionPipeline } from "@/lib/pipeline/transcription-pipeline";
import { getTranscriptByVideoExtId, upsertTranscript } from "@/lib/db/transcripts";

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

    const videoId = parsed.videoId;
    const preferredLang = "en"; // Defaulting to en for now
    
    // Check Database Cache first
    const cached = await getTranscriptByVideoExtId(videoId, preferredLang);
    
    // If the cache has best quality, return immediately
    if (cached && (cached.quality === "subtitle-enhanced" || cached.quality === "audio-transcribed")) {
      return NextResponse.json(
        {
          videoId,
          source: parsed.source,
          transcript: {
            segments: cached.segments,
            source: cached.quality,
            subtitleType: cached.quality === "subtitle-enhanced" ? "manual" : "auto-generated",
            aiEnhanced: cached.quality === "subtitle-enhanced",
            segmentCount: cached.segments.length,
          },
        },
        { status: 200 }
      );
    }

    // Run the pipeline (passing initial state if we had a lower-quality cache)
    const result = await runTranscriptionPipeline(
      parsed.source,
      videoId,
      preferredLang,
      cached ? { segments: cached.segments, quality: cached.quality } : undefined
    );

    // Upsert into DB if pipeline yielded results
    if (result.source !== "failed" && result.segments.length > 0) {
      // Fire and forget caching (non-blocking for the response)
      upsertTranscript(videoId, preferredLang, result.source, result.segments, cached?.transcriptId)
        .catch(err => console.error("[Video Import] Failed to upsert transcript:", err));
    }

    return NextResponse.json(
      {
        videoId,
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
