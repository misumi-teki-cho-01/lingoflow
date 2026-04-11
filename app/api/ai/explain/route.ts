import { NextResponse } from "next/server";
import { generateText } from "@/lib/gemini/client";
import { EXPLAIN_DICTATION_PROMPT } from "@/lib/ai/prompts";

export async function POST(request: Request) {
  try {
    const { text, locale = "zh" } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 },
      );
    }

    const prompt = EXPLAIN_DICTATION_PROMPT
      .replace("{{locale}}", locale)
      .replace("{{text}}", text);

    const responseText = await generateText(prompt);
    
    const cleanJsonStr = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    
    let definitions = {};
    try {
      definitions = JSON.parse(cleanJsonStr);
    } catch (parseError) {
      console.error("[Explain API] JSON Parse Error. Raw output:", responseText);
      return NextResponse.json(
        { error: "Failed to parse AI output into JSON." },
        { status: 500 },
      );
    }

    return NextResponse.json({ definitions });
  } catch (error: any) {
    console.error("[Explain API] Error:", error.message);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
