import { NextResponse } from "next/server";

const retired = () => NextResponse.json(
  { code: "WAITLIST_CLOSED", error: "The launch waitlist is closed." },
  { status: 410, headers: { "Cache-Control": "private, no-store" } }
);

export async function GET() { return retired(); }
export async function POST() { return retired(); }
