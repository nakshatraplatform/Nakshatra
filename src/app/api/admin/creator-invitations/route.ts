import { NextResponse } from "next/server";

const retired = () => NextResponse.json(
  { code: "CREATOR_INVITES_CLOSED", error: "Creators can now sign up directly." },
  { status: 410, headers: { "Cache-Control": "private, no-store" } }
);

export async function GET() { return retired(); }
export async function POST() { return retired(); }
