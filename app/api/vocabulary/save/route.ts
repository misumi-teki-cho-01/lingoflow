import { NextResponse } from "next/server";
import { saveVocabularyAndAnnotations } from "@/lib/db/vocabulary";
import { saveUserDictation } from "@/lib/db/dictations";

export async function POST(request: Request) {
  try {
    const { videoId, definitions, dictation, sourceMode } = await request.json();

    if (!videoId || !definitions) {
      return NextResponse.json(
        { error: "videoId and definitions are required" },
        { status: 400 },
      );
    }

    const mode: "cc" | "scribe" =
      sourceMode === "cc" || sourceMode === "scribe" ? sourceMode : "scribe";

    if (Object.keys(definitions).length > 0) {
      await saveVocabularyAndAnnotations(videoId, definitions, mode);
    }

    if (
      dictation &&
      typeof dictation.contentHtml === "string" &&
      Array.isArray(dictation.segments) &&
      dictation.segments.length > 0
    ) {
      await saveUserDictation({
        videoExtId: videoId,
        contentHtml: dictation.contentHtml,
        segments: dictation.segments,
      });
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[Vocabulary Save API] Error:", message);
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
