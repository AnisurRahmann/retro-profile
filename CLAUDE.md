# arshakil.com — "Talk to my agent"

Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind 4, pnpm. Branch: `redesign/talk-to-my-agent`. Never touch `main`.

## Commands

- `pnpm dev` · `pnpm build` (prebuild regenerates `src/agent/knowledge.md`) · `pnpm start`
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — must be green before any commit
- `pnpm shots` — screenshots at 360/768/1440 into `.shots/` (needs `CHAT_MOCK=1 pnpm start -p 3100`)
- `pnpm e2e` — builds a separate test build (`NEXT_PUBLIC_E2E=1`, `.next-e2e`) and runs Playwright on :3101 with `CHAT_MOCK=1`. `pnpm e2e:only` reuses the last test build.
- `WIDTHS=375,1440,1920 pnpm shots` — page shots; `chat-killswitch` needs a second server: `CHAT_MOCK=1 CHAT_ENABLED=false pnpm start -p 3103`
- `pnpm shots:sky` — Sylhet Sky v2 review shots (8 states × 1440/375 × top / Shipped / closer) into `.shots/sky-v2/` (needs the e2e build on :3101)
- Sky probes (`scripts/probe/`, against a running build): `gpu-sky.mts` (GPU + CPU ms/frame), `scroll-trace.mts`
  (trace + no long tasks while scrolling), `scrim-edge.mts` (is the scrim edge a line?), `walk.mts` (landscape at
  each landmark), `state.mts` (`window.__sky`), `sheet.mts` (contact sheets)
- `pnpm eval:live` — real-model evals. Shakil runs this himself. Never in CI or tests.

## Rules

- ALL copy and data live in `src/content.ts` (zod-validated by `src/content.schema.ts`). Components import from
  `src/site.ts`, which strips unresolved `[[placeholders]]`. No copy in components (a test enforces it).
- The agent's knowledge base is generated from the same file. Edit content, then `pnpm knowledge`.
- Never invent metrics, quotes, dates, logos or links. Never mention relocation, visas, salary, "open to work".
- Server Components by default. `"use client"` only for: status line, show-more, chat UI, and the sky (controller, label, strip, stage, renderer).
- No UI kits, animation libraries, icon packs or the Vercel AI SDK. Log any new dependency in `docs/DECISIONS.md`.
- Never put real keys anywhere but `.env.local`. Never call the real Anthropic API in tests.
- Do not deploy, push, create cloud projects or run SQL against a real DB.

## Design (short form)

- Tokens only (CSS variables in `src/app/globals.css`): `--ink #0B1220` bg, `--surface`, `--surface-2`, `--hairline`,
  `--text`, `--graphite`, `--on-sky` (82% `--text`: the hero's and header's secondary text over the open sky stage),
  `--signal #F5A524` (ONLY: waveform, in-build dot, focus ring, sky label and strip sun glyph at golden hour / civil
  twilight, preview label, fireflies), mention chip vars, 6 tile colours.
  No hex anywhere else (sole exception: the sky palette in `src/lib/sky/palette.ts`: keyframes, stars, sun, lit
  windows). No #000/#fff.
- Geist Sans; Geist Mono for metadata/numbers/monogram. H1 36/40 500 −0.02em. Section heads 16/500. Body 16/24.
  Card title 14/500, subtitle 14 graphite, mono meta 12 graphite.
- One 768px column; 20px side padding below 808px. Header 64px, not sticky, transparent over the sky stage.
  Section gap 64 desktop / 48 mobile. Home starts with the sky stage: full-bleed, min(62svh, 640px) desktop / 70svh
  mobile, ≥ 460px, hero anchored to its bottom in the column, open sky above.
- Cards: surface, radius 8, 14×16 padding, hover → hairline border + surface-2 (150ms). Whole card is the link.
- No gradients, glows, glass, bento, illustrations, parallax or scroll fade-ups. **One exception:** the Sylhet Sky
  background (`src/components/sky`, `src/lib/sky`). Gradients and glows are allowed only inside the sky renderer.
  Nothing else gets a decorative gradient. (The chat dock fade is functional, from the original brief, and stays.)
- Motion: waveform, status line, show-more, chat ring/dots, and the sky (incl. its landscape and slow life). Every
  one has a reduced-motion path. Nothing else moves.
- Background stack (all fixed, aria-hidden, pointer-events none), "Sylhet Sky": the real sky over Sylhet right now.
  z −4 CSS gradient (`--sky-zenith/mid/horizon`, set before paint by an inline script, the no-JS and reduced-motion
  fallback) · z −3 WebGL2 atmosphere at 0.4 × DPR (clouds, fog, horizon glow, moon glow, lightning) · z −2 Canvas 2D
  particles (arc, stars, moon, sun, birds, planes, meteors, rain) · z −2 landscape band (fixed bottom, 18vh / 14svh,
  110–200px + 120px headroom: four parallax silhouette layers, night lights, fireflies, rickshaw, take-off) · z −1
  column scrim (fades in below the stage; 220px smootherstep sides; no sides below 808px) · z −1 grain. Text scrims
  (hero block, header row) sit in the page. Body is transparent; `<html>` paints `--ink`.
- Sky v2 rules: the celestial layer never scrolls (parallax 0); the landscape is real parallax (L1 0.04, L2 0.15,
  L3 0.45, L4 0.9) and landmarks centre when their section's top is at 40% (`src/lib/sky/landscape/anchors.ts`).
  Scroll is read by a passive listener and applied in rAF; landscape paths never re-run per scroll frame (strip
  bitmaps). Time travel goes through `src/lib/sky/scrub.ts` (preview minutes, back to now in 1.6 s). The sun and
  moon are dimmed to `SUN_UNDER_TEXT` behind text and the guard counts it.
- Sky rules: state comes from sun elevation (suncalc), never clock hour. Every displayed time is Asia/Dhaka via Intl.
  Weather comes only from `/api/sylhet` (server-cached Open-Meteo, 15 min); the browser never calls Open-Meteo.
  The keyframe palette lives in `src/lib/sky/palette.ts` (the only hex outside `globals.css`); retune it only with
  the contrast sweep green (`tests/unit/sky-contrast.test.ts`). `--scrim-a` is solved, never tuned by eye. Amber
  appears in the sky system only as the sun glyph (label, strip) at golden hour / civil twilight and as fireflies.
  Lightning never flashes the whole screen. Emit meteors through `emitSky` (`src/lib/signal-bus.ts`), never on
  scroll. Budget: lazy renderer chunk 23 kB gzip (v2; was 9 kB, DECISIONS #95), eager sky ≤ 13 kB, both excluding
  suncalc; inline first-paint script < 1.5 kB; atmosphere GPU ≤ 2 ms at 1920×1080 DPR 2 (`scripts/probe/gpu-sky.mts`);
  no long task > 50 ms while scrolling (`scripts/probe/scroll-trace.mts`). Tests and e2e run with `WEATHER_MOCK=1`;
  never hit Open-Meteo from a test.
- Accessibility beats design when they conflict; log it.

## Docs

`docs/PLAN.md` (tasks) · `docs/PROGRESS.md` (resume from here) · `docs/DECISIONS.md` · `docs/OPEN_QUESTIONS.md`
