import { NextResponse } from "next/server";
type Context = { params: Promise<{ introductionRef: string }> };
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

export async function POST(_request: Request, context: Context) {
  await context.params;
  return NextResponse.json(
    { code: "BROKER_INTRODUCTION_PASS_RETIRED", error: "Sign in as the intended customer to open this introduction." },
    { status: 410, headers }
  );
}
