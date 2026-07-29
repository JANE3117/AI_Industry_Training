import { NextResponse } from "next/server";

// Deliberately at the app root (not /api/health) — the hackathon portal's
// submission contract requires exactly this path.
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
