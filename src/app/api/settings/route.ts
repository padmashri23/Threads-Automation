import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/store";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import type { StyleSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ settings: getSettings(), defaults: DEFAULT_SETTINGS });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<StyleSettings>;
  const merged: StyleSettings = { ...DEFAULT_SETTINGS, ...getSettings(), ...body };
  merged.lookbackHours = Math.min(96, Math.max(12, Number(merged.lookbackHours) || 48));
  saveSettings(merged);
  return NextResponse.json({ settings: merged });
}
