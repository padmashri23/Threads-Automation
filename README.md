# Threads AI Editor

Your personal AI technology editor for [Threads](https://www.threads.net). On every run it scans about 50 sources across the AI and tech ecosystem, works out which **two** developments are genuinely worth posting about today, fact-checks them against original sources, writes Threads-ready posts in your voice, and renders image cards or carousels to go with them.

It is **not** a news aggregator. It optimises for signal over noise: if only one story clears the bar you get one, and if none does it tells you so.

Built with Next.js 16, TypeScript and Tailwind. Runs entirely on your machine, on free APIs, with no database and no billing required.

---

## Table of contents

- [Why this exists](#why-this-exists)
- [What a run does](#what-a-run-does)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Pages](#pages)
- [Scoring, explained](#scoring-explained)
- [Image cards and carousels](#image-cards-and-carousels)
- [API](#api)
- [Project structure](#project-structure)
- [Data and privacy](#data-and-privacy)
- [Sources and known limitations](#sources-and-known-limitations)
- [Troubleshooting](#troubleshooting)

---

## Why this exists

Posting twice a day about AI means reading far more than you can, deciding what actually matters, checking it is true, and then writing something a real person would want to read. Most tools solve the first step and dump a feed on you. This one does the whole job and hands you a draft you can trust, edit and publish.

Design principles:

- **Editorial judgment over volume.** Two stories a day, ranked and justified, not a firehose.
- **Nothing unverified reaches the post.** Every claim in a post or card is traced to fetched source text.
- **Your voice, not the model's.** Tone, audience, depth, banned phrases and topic preferences are all yours to set.
- **Free by default.** Free public data sources plus the Gemini free tier. No card on file.

---

## What a run does

1. **Collect.** Scans sources in parallel: Hacker News, Reddit, GitHub (fast-rising repos), arXiv, Hugging Face (daily papers, trending models and spaces), YouTube AI channels, Lobsters, Product Hunt, the AI labs' own announcement pages (OpenAI, Google DeepMind, Google Research, Anthropic, Meta, Microsoft Research, NVIDIA, Mistral, xAI, Apple ML, Hugging Face, AWS, Cloudflare, GitHub), the major tech publications (TechCrunch, The Verge, Wired, Ars Technica, MIT Technology Review, MIT News, CNBC, TechRadar, IEEE Spectrum, The Register, Engadget, The Decoder, VentureBeat, MarkTechPost, Simon Willison and more), and a Google News wide net that pulls in Reuters, Bloomberg, WSJ, The Information, ZDNET and any other outlet covering a story. X/Twitter is included when a bearer token is configured.
2. **Filter and merge.** Noise is dropped with keyword relevance rules, then duplicate URLs are merged. The same event reported by ten outlets and discussed on HN, Reddit and YouTube becomes a single story cluster. Cross-source coverage raises confidence that it is really trending.
3. **Score.** Each cluster gets a transparent **Trend Score** and an editorial **Content Quality Score**. See [Scoring, explained](#scoring-explained).
4. **Remember.** Candidates are checked against your content history so yesterday's story is not suggested again unless there is a genuinely new development.
5. **Verify.** The top candidates' original pages are fetched and read (via Readability). A fact-check pass records which claims are confirmed by which source, what is unverified and what conflicts. Status is one of `official`, `reliable`, `early`, `rumor`, `unverified`, `conflicting`. Unverified and rumor stories are never selected.
6. **Select.** The best story, then the best *different* story. Both must clear overall, quality, trend and verification thresholds.
7. **Write.** A Threads post per story, grounded only in the verified fact sheet, in your configured voice, with a strong but truthful hook and a clear "why it matters".
8. **Design.** A single image card or a 3 to 6 card carousel per story, when the facts justify it. The model writes the card copy from the fact sheet and the app renders the PNGs locally. No image model, no cost.

Progress is streamed to the UI stage by stage, with a per-source report of what each collector returned.

---

## Quick start

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/padmashri23/Threads-Automation.git
cd Threads-Automation
npm install
cp .env.example .env.local        # on Windows: copy .env.example .env.local
```

Open `.env.local` and add one model provider key. The free option is Google AI Studio:

1. Create a key at https://aistudio.google.com/apikey (no credit card).
2. Paste it as `GEMINI_API_KEY=...`.

Then run the app:

```bash
npm run dev
```

Open http://localhost:3000, go to **Style** to set your handle and voice, then press **Run research** on the **Today** page.

---

## Configuration

All configuration is in `.env.local`. See `.env.example` for the full annotated list.

### Model provider (pick one)

The app auto-detects whichever key is present. Set `LLM_PROVIDER` to force one when several keys are set.

| Provider | Cost | Variables |
|---|---|---|
| **Google AI Studio (Gemini)** | Free tier, no card | `GEMINI_API_KEY`, optional `GEMINI_MODEL`, `GEMINI_MODELS` |
| **Groq** or any OpenAI-compatible endpoint (OpenRouter, Mistral, Ollama) | Free tier available | `OPENAI_COMPAT_API_KEY`, `OPENAI_COMPAT_BASE_URL`, `OPENAI_COMPAT_MODEL` |
| **Anthropic Claude** | Paid, best editorial judgment | `ANTHROPIC_API_KEY`, optional `CLAUDE_MODEL` |

**About the Gemini free tier.** Quotas are roughly 20 requests per day *per model*, and one research run makes about 12 model calls. The app therefore rotates through a pool of free Flash models (`GEMINI_MODELS`) and automatically skips any model that has hit its daily limit. Pro and image models have no free quota and are never used.

### Optional source keys (all free tiers)

The app works without any of these. They add coverage or richer signals.

| Variable | What it adds |
|---|---|
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | Upvote and comment counts from Reddit. Without them the app falls back to Reddit RSS. |
| `GITHUB_TOKEN` | Higher rate limits for repository search. No scopes needed. |
| `YOUTUBE_API_KEY` | Search-wide video discovery beyond the built-in channel list. |
| `X_BEARER_TOKEN` | X/Twitter as a source. X charges for API access, so this is off by default. |

### Style settings (in the app)

Everything about *how* posts are written lives on the **Style** page and is stored in `data/settings.json`:

- Brand handle shown on every image card, and card theme (dark or light)
- Whether cards are created automatically, always, or never
- Tone, audience and writing style, in your own words
- Technical depth (light, balanced, deep) and post length (short, standard, thread)
- Preferred topics, topics to avoid, and banned phrases (ships with a sensible list: "game-changer", "delve", "buckle up", and friends)
- Research window in hours (default 48)
- Emoji and hashtags on or off

---

## Pages

| Page | What you do there |
|---|---|
| **Today** | Run research. See story #1 and #2 with why they are trending, scores, sources, the generated post and its image cards. Edit, regenerate, shorten, make more conversational, more technical or more human, improve the hook, give a custom instruction, copy, mark as published. Create or regenerate cards, edit card text, re-render, download PNGs. |
| **Discover** | Every story identified in the run, sortable by trending, latest or quality, and filterable by category: AI, Technology, Research, Developer, Open Source, Robotics, Startups, Cybersecurity, AI Agents, AI Coding, Hardware, Big Tech. |
| **Story** | The full picture for one story: what happened, why it matters, why it is trending, the complete fact check, signal breakdown, every source, related stories, and the editor. |
| **History** | Date, story, post, category, scores and status (suggested, published, skipped). This is what prevents repetition. |
| **Style** | Voice and card settings described above. |

---

## Scoring, explained

Every score is broken down in the UI so you can see why a story ranked where it did.

**Trend Score** (is it really moving right now?) combines:

- Independent coverage across outlets and communities
- Discussion velocity: points and comments per hour on HN, Reddit and Lobsters
- Developer traction: GitHub stars, Hugging Face downloads and likes
- Presence of an official or primary source
- Freshness and momentum within the research window
- Video interest on YouTube

**Content Quality Score** (is it worth your audience's time?) is an editorial assessment of importance, novelty, discussability and developer relevance, with explicit penalties for "viral but shallow" items and reposted old news.

**Credibility** adjusts both. Official domains (labs, companies, arXiv) and tier-one publications carry more weight than anonymous aggregators, and the fact-check status caps what can be selected.

Thresholds are defined in `src/lib/pipeline/run.ts` if you want a stricter or looser editor.

---

## Image cards and carousels

Cards are 1080 x 1350 PNGs (4:5, the tallest format Threads shows without cropping), rendered server-side with [Satori](https://github.com/vercel/satori) and [resvg](https://github.com/RazrFalcon/resvg) using the Inter typeface. There is no image-generation model involved.

The model only decides the *format* (`none`, `single`, `carousel`) and writes the *copy*: a cover, then point, stat or quote cards, then a closing card with a takeaway. Every stat and quote must appear verbatim in the verified fact sheet. Numbering, category label, brand handle and source attribution are added by the template.

You can edit any card's text in the UI and re-render instantly without a model call, then download the PNGs and attach them in Threads.

---

## API

All routes are local, unauthenticated and JSON.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/research` | Start a research run. Returns immediately; poll `GET` for progress. |
| `GET` | `/api/research` | Current or latest run, with stage, progress, log and stats. |
| `GET` | `/api/sources` | Run every collector without the model and report what each source returned. Useful for checking coverage. |
| `GET` | `/api/stories/:id` | One story with fact check, signals, sources and post. |
| `PATCH` | `/api/stories/:id` | Update post text or status. |
| `POST` | `/api/stories/:id/refine` | Apply a refine action: `regenerate`, `shorter`, `conversational`, `technical`, `hook`, `humanize`, `custom`. |
| `POST` | `/api/stories/:id/visuals` | Plan and render cards (`auto`, `single` or `carousel`, with an optional instruction). |
| `PATCH` | `/api/stories/:id/visuals` | Re-render cards after manual text edits. |
| `GET` | `/api/visuals/:storyId/:file` | Serve a rendered PNG. |
| `GET` / `PATCH` | `/api/history` | Read history, or update an entry's status. |
| `GET` / `PUT` | `/api/settings` | Read or replace style settings. |

---

## Project structure

```
src/
  app/                    Next.js App Router pages and API routes
    page.tsx              Today
    discover/  history/  settings/  story/[id]/
    api/                  research, sources, stories, visuals, history, settings
  components/             UI: research panel, story cards, editor, visuals panel, settings form
  lib/
    ai/client.ts          Provider layer: one structured() call, schema-validated JSON out,
                          Gemini model-pool rotation, retries, corrective re-prompts
    sources/              One collector per source (HN, Reddit, GitHub, arXiv, HF, YouTube,
                          Lobsters, Google News, X, RSS feeds, lab page scraping)
    pipeline/
      relevance.ts        Keyword relevance filter and pre-scoring
      cluster.ts          URL merge, heuristic pre-clustering, model-assisted clustering
      scoring.ts          Trend and quality scores, official and tier-one domain lists
      history.ts          Repeat detection against covered stories
      verify.ts           Source fetching and fact-checking
      generate.ts         Post writing and refine actions
      run.ts              Orchestration, thresholds, progress reporting
    visuals/
      plan.ts             Model plans card format and copy from the fact sheet
      render.ts           Satori + resvg PNG rendering, dark and light themes
    extract.ts            Article text extraction (Readability + jsdom)
    store.ts              JSON persistence under data/
    settings.ts  types.ts  utils.ts  http.ts
```

---

## Data and privacy

Everything is stored as JSON and PNG files under `data/` (gitignored): runs, stories, history, settings, rendered cards and a fetch cache. There is no database and no account.

The only network traffic is the source fetches and the model calls to whichever provider you configured. Nothing else leaves your machine.

---

## Sources and known limitations

- **Instagram** has no public API for trend discovery and is not polled.
- **Papers With Code** shut down in 2025. Hugging Face Papers fills that role.
- **Reddit** blocks anonymous JSON from many networks. Without OAuth credentials the app falls back to RSS (titles and links, no vote counts).
- **YouTube** channel feeds are sometimes unavailable. The app falls back to reading the channel page.
- **X/Twitter** is the only source that costs money. It stays off unless you add a token.
- Some publisher feeds rate-limit or change URLs. A failing source is reported in the run log and skipped, never fatal.

---

## Troubleshooting

**"No model configured."** Add `GEMINI_API_KEY` (or another provider key) to `.env.local` and restart `npm run dev`. Environment variables are read at startup.

**A run stops with a quota error.** The Gemini free tier is per model per day. Add more models to `GEMINI_MODELS`, wait for the daily reset, or switch to Groq for the day.

**Fewer stories than expected.** Check `GET /api/sources` to see which collectors returned items. A short research window (`lookbackHours`) on a quiet day can legitimately produce one or zero picks; that is the editor doing its job.

**Cards fail to render.** The renderer reads Inter font files from `node_modules/@fontsource/inter`. Run `npm install` again if that directory is missing.

**Windows and native modules.** `@resvg/resvg-js` ships prebuilt binaries. If install fails, make sure you are on a supported Node version and re-run `npm install`.

---

## Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```
