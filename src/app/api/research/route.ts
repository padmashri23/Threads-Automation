import { NextResponse } from "next/server";
import { getActiveRun, startRun } from "@/lib/pipeline/run";
import { getLatestRun, getRun } from "@/lib/store";
import { hasApiKey, SETUP_MESSAGE } from "@/lib/ai/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasApiKey()) {
    return NextResponse.json({ error: SETUP_MESSAGE }, { status: 400 });
  }
  const run = startRun();
  return NextResponse.json({ run });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("runId");
  const run = id ? getRun(id) : (getActiveRun() ?? getLatestRun());
  return NextResponse.json({ run, hasApiKey: hasApiKey() });
}
