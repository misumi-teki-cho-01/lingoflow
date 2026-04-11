import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { text, context } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Selected text is required" },
        { status: 400 },
      );
    }

    // TODO: Phase 4 — Call Gemini API to generate explanation
    //       for the selected text within its transcript context.

    return NextResponse.json({
      message: "AI explanation endpoint — not yet implemented",
      text,
      context,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
