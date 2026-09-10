import fs from "fs";
import path from "path";
import type { Slide, Story, StyleSettings, Visuals } from "../types";
import { planVisuals } from "./plan";
import { CARD_H, CARD_W, renderSlidePng } from "./render";

const VISUALS_DIR = path.join(process.cwd(), "data", "visuals");

export function visualsDir(storyId: string): string {
  const d = path.join(VISUALS_DIR, storyId.replace(/[^a-z0-9_-]/gi, "_"));
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

export function visualFilePath(storyId: string, file: string): string | null {
  const safe = path.basename(file);
  const p = path.join(visualsDir(storyId), safe);
  return fs.existsSync(p) ? p : null;
}

/** Render every slide to PNG and return slides with file names attached. */
export async function renderAll(story: Story, slides: Slide[], settings: StyleSettings, version: number): Promise<Slide[]> {
  const dir = visualsDir(story.id);
  const out: Slide[] = [];
  for (let i = 0; i < slides.length; i++) {
    const file = `slide-${i + 1}-v${version}.png`;
    const png = await renderSlidePng(slides[i], i, slides.length, { theme: settings.visualTheme, handle: settings.brandHandle, category: story.category });
    fs.writeFileSync(path.join(dir, file), png);
    out.push({ ...slides[i], file });
  }
  return out;
}

/** Plan with the model, then render. */
export async function generateVisuals(story: Story, settings: StyleSettings, mode: "auto" | "single" | "carousel" = "auto", instruction?: string): Promise<Visuals> {
  const version = (story.visuals?.version ?? 0) + 1;
  const plan = await planVisuals(story, settings, mode, instruction);
  const slides = plan.mode === "none" ? [] : await renderAll(story, plan.slides, settings, version);
  return { mode: plan.mode, reason: plan.reason, slides, width: CARD_W, height: CARD_H, generatedAt: new Date().toISOString(), version };
}

/** Re-render after manual text edits; no model involved. */
export async function rerenderVisuals(story: Story, slides: Slide[], settings: StyleSettings): Promise<Visuals> {
  const version = (story.visuals?.version ?? 0) + 1;
  const clean = slides.filter((s) => s.title?.trim());
  const rendered = await renderAll(story, clean, settings, version);
  return {
    mode: rendered.length === 0 ? "none" : rendered.length === 1 ? "single" : "carousel",
    reason: story.visuals?.reason ?? "Edited by you.",
    slides: rendered,
    width: CARD_W,
    height: CARD_H,
    generatedAt: new Date().toISOString(),
    version,
  };
}
