import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { code: "CREATOR_INVITES_CLOSED", error: "Invitations are no longer needed. Sign in to create your portfolio." },
    { status: 410, headers: { "Cache-Control": "private, no-store" } }
  );
}
