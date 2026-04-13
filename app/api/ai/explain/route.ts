import { NextResponse } from "next/server";
import { explainTextVocabulary } from "@/lib/ai/services";
import test_definitions from "@/test_definitions.json";
export async function POST(request: Request) {
  try {
    const { text, wordsToExplain, locale = "zh" } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(wordsToExplain) || wordsToExplain.length === 0) {
      return NextResponse.json(
        { error: "wordsToExplain array is required and must not be empty" },
        { status: 400 },
      );
    }

    // const definitions = await explainTextVocabulary(text, wordsToExplain, locale);
    return NextResponse.json({ definitions: test_definitions });

  } catch (error: any) {
    console.error("[Explain API] Error:", error.message);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

