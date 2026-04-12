import { NextResponse } from "next/server";
import { explainTextVocabulary } from "@/lib/ai/services";

export async function POST(request: Request) {
  try {
    const { text, locale = "zh" } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 },
      );
    }

    const definitions = await explainTextVocabulary(text, locale);
    return NextResponse.json({ definitions });

  } catch (error: any) {
    console.error("[Explain API] Error:", error.message);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

