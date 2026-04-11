import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // TODO: Phase 2 — Query transcript status from Supabase

  return NextResponse.json({
    id,
    status: "pending",
    message: "Transcript status endpoint — not yet implemented",
  });
}
