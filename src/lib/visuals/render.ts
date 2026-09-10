import fs from "fs";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { Slide } from "../types";

export const CARD_W = 1080;
export const CARD_H = 1350; // 4:5, the tallest format Threads shows without cropping

type Weight = 400 | 600 | 700 | 800;
let fontCache: Array<{ name: string; data: ArrayBuffer; weight: Weight; style: "normal" }> | null = null;

function loadFonts() {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "node_modules", "@fontsource", "inter", "files");
  const weights: Weight[] = [400, 600, 700, 800];
  fontCache = weights.map((w) => {
    const buf = fs.readFileSync(path.join(dir, `inter-latin-${w}-normal.woff`));
    return { name: "Inter", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight: w, style: "normal" as const };
  });
  return fontCache;
}

interface Theme {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  line: string;
}

const THEMES: Record<"dark" | "light", Theme> = {
  dark: { bg: "#101014", fg: "#f4f1ea", muted: "#a5a09a", accent: "#ff6d42", line: "#2a2a30" },
  light: { bg: "#f6f4ee", fg: "#16150f", muted: "#6b6860", accent: "#d9481f", line: "#e2ded4" },
};

// Satori consumes React-like element objects; we build them directly to avoid JSX in a .ts file.
type El = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): El => ({ type, props: { style, children } });

function sizeFor(text: string, base: number, min: number, perChar = 0.55): number {
  // Shrink long text so it fits; satori wraps lines but we keep the block readable.
  const lines = Math.ceil((text.length * perChar * base) / (CARD_W - 200));
  if (lines <= 3) return base;
  return Math.max(min, Math.round(base * Math.sqrt(3 / lines)));
}

export function slideElement(slide: Slide, index: number, total: number, opts: { theme: "dark" | "light"; handle: string; category: string }): El {
  const t = THEMES[opts.theme];
  const pad = 96;
  const header = el("div", { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }, [
    el("div", { display: "flex", alignItems: "center", gap: 18 }, [
      el("div", { width: 22, height: 22, background: t.accent, borderRadius: 6 }),
      el("div", { fontSize: 28, fontWeight: 600, color: t.muted, letterSpacing: 2, textTransform: "uppercase" }, opts.category),
    ]),
    total > 1 ? el("div", { fontSize: 28, fontWeight: 600, color: t.muted }, `${index + 1}/${total}`) : el("div", {}, ""),
  ]);
  const footer = el("div", { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", borderTop: `2px solid ${t.line}`, paddingTop: 34 }, [
    el("div", { fontSize: 30, fontWeight: 600, color: t.fg }, opts.handle),
    el("div", { fontSize: 26, fontWeight: 400, color: t.muted }, slide.source ? `Source: ${slide.source}` : ""),
  ]);

  let main: El;
  // Skip a kicker that merely repeats the category already shown in the header.
  const kickerText = slide.kicker && slide.kicker.trim().toLowerCase() !== opts.category.trim().toLowerCase() ? slide.kicker : null;
  const kicker = kickerText ? el("div", { fontSize: 30, fontWeight: 700, color: t.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 34 }, kickerText) : null;
  switch (slide.kind) {
    case "cover": {
      const fs = sizeFor(slide.title, 84, 56, 0.5);
      main = el("div", { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }, [
        kicker,
        el("div", { fontSize: fs, fontWeight: 800, lineHeight: 1.08, color: t.fg, letterSpacing: -1.5 }, slide.title),
        slide.body ? el("div", { fontSize: 38, fontWeight: 400, lineHeight: 1.4, color: t.muted, marginTop: 44 }, slide.body) : null,
      ]);
      break;
    }
    case "stat": {
      const stat = slide.stat ?? slide.title;
      const sfs = sizeFor(stat, 150, 72, 0.6);
      main = el("div", { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }, [
        kicker,
        el("div", { fontSize: sfs, fontWeight: 800, lineHeight: 1, color: t.accent, letterSpacing: -3 }, stat),
        el("div", { fontSize: 46, fontWeight: 700, lineHeight: 1.2, color: t.fg, marginTop: 40 }, slide.stat ? slide.title : ""),
        slide.body ? el("div", { fontSize: 34, fontWeight: 400, lineHeight: 1.45, color: t.muted, marginTop: 30 }, slide.body) : null,
      ]);
      break;
    }
    case "quote": {
      const qfs = sizeFor(slide.title, 56, 38, 0.5);
      main = el("div", { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }, [
        kicker,
        el("div", { fontSize: 120, fontWeight: 800, color: t.accent, lineHeight: 0.6, marginBottom: 30 }, "“"),
        el("div", { fontSize: qfs, fontWeight: 600, lineHeight: 1.3, color: t.fg }, slide.title),
        slide.body ? el("div", { fontSize: 32, fontWeight: 400, color: t.muted, marginTop: 40 }, slide.body) : null,
      ]);
      break;
    }
    case "closing": {
      const fs = sizeFor(slide.title, 64, 44, 0.5);
      main = el("div", { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }, [
        kicker ?? el("div", { fontSize: 30, fontWeight: 700, color: t.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 34 }, "Takeaway"),
        el("div", { fontSize: fs, fontWeight: 800, lineHeight: 1.12, color: t.fg, letterSpacing: -1 }, slide.title),
        slide.body ? el("div", { fontSize: 36, fontWeight: 400, lineHeight: 1.42, color: t.muted, marginTop: 40 }, slide.body) : null,
      ]);
      break;
    }
    default: {
      const fs = sizeFor(slide.title, 64, 44, 0.5);
      main = el("div", { display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }, [
        kicker,
        el("div", { fontSize: fs, fontWeight: 700, lineHeight: 1.12, color: t.fg, letterSpacing: -1 }, slide.title),
        slide.body ? el("div", { fontSize: 36, fontWeight: 400, lineHeight: 1.42, color: t.muted, marginTop: 40 }, slide.body) : null,
      ]);
    }
  }

  return el(
    "div",
    { display: "flex", flexDirection: "column", width: CARD_W, height: CARD_H, background: t.bg, color: t.fg, padding: pad, fontFamily: "Inter" },
    [header, main, footer],
  );
}

export async function renderSlidePng(slide: Slide, index: number, total: number, opts: { theme: "dark" | "light"; handle: string; category: string }): Promise<Buffer> {
  const element = slideElement(slide, index, total, opts);
  const svg = await satori(element as unknown as React.ReactNode, { width: CARD_W, height: CARD_H, fonts: loadFonts() });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: CARD_W } }).render().asPng();
  return Buffer.from(png);
}
