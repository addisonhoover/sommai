# SommAI

> Your sommelier in an instant.

A luxe, camera-first wine intelligence app. Snap a wine **menu** or **bottle label** and SommAI reads it with Claude vision, then returns flavor notes, structure, terroir, pairings, and a personal **Fit Score for every palate at the table**.

## Product principles

1. **Instant camera.** Tap the app → live camera → snap. No splash, no login gate. Scoring runs against the saved palates automatically.
2. **Refine after the shot.** The first answer is immediate. A "Refine" step then tightens for the table — occasion, dishes, one-bottle-vs-glass — and re-ranks in place without a re-scan.
3. **A living, portable palate.** Bootstrap a profile by importing tasting notes (`.md`, paste, file); it keeps learning from every Save / Not-for-me; export it back out as `.md` anytime. Multiple palates supported — a couple sees dual fit scores per wine.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind v4**, PWA-installable
- **Claude vision** (`claude-opus-4-8`) — `/api/analyze` (vision + per-palate scoring in one structured-output call), `/api/refine` (text-only re-rank), `/api/import` (notes → structured palate)
- **localStorage** for palates + journal today; **Supabase** next for accounts + cross-device sync
- Deploys to **Vercel**; the Anthropic key lives only in serverless functions

## Run it locally

```bash
# 1. Put your Anthropic API key in .env.local:  ANTHROPIC_API_KEY=sk-ant-...
# 2. npm run dev
# 3. Open http://localhost:3000  (use the upload button on desktop — no camera)
```

## Deploy

Push to GitHub → import in Vercel → add `ANTHROPIC_API_KEY` env var. Done.

## History

v1 (June 2026) lived in a Dropbox folder; Dropbox dehydrated it to online-only placeholders and corrupted the git repo. v2 is a clean rebuild at `~/Projects/sommai` with GitHub as the source of truth. Don't develop inside Dropbox.
