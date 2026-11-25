# arshakil.com — "Talk to my agent"

Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind 4, pnpm. Branch: `redesign/talk-to-my-agent`. Never touch `main`.

## Commands

- `pnpm dev` · `pnpm build` (prebuild regenerates `src/agent/knowledge.md`) · `pnpm start`
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — must be green before any commit
- `pnpm shots` — screenshots at 360/768/1440 into `.shots/` (needs `CHAT_MOCK=1 pnpm start -p 3100`)
- `pnpm e2e` — builds a separate test build (`NEXT_PUBLIC_E2E=1`, `.next-e2e`) and runs Playwright on :3101 with `CHAT_MOCK=1`. `pnpm e2e:only` reuses the last test build.
- `WIDTHS=375,1440,1920 pnpm shots` — page shots; `chat-killswitch` needs a second server: `CHAT_MOCK=1 CHAT_ENABLED=false pnpm start -p 3103`
- `pnpm shots:sky` — Sylhet Sky review shots (10 states × 1440/375, `/` and `/chat`) into `.shots/sky/` (needs the e2e build on :3101)
- `pnpm eval:live` — real-model evals. Shakil runs this himself. Never in CI or tests.

## Rules

- ALL copy and data live in `src/content.ts` (zod-validated by `src/content.schema.ts`). Components import from
  `src/site.ts`, which strips unresolved `[[placeholders]]`. No copy in components (a test enforces it).
- The agent's knowledge base is generated from the same file. Edit content, then `pnpm knowledge`.
- Never invent metrics, quotes, dates, logos or links. Never mention relocation, visas, salary, "open to work".
- Server Components by default. `"use client"` only for: status line, show-more, chat UI, and the sky (controller, label, renderer).
- No UI kits, animation libraries, icon packs or the Vercel AI SDK. Log any new dependency in `docs/DECISIONS.md`.
- Never put real keys anywhere but `.env.local`. Never call the real Anthropic API in tests.
- Do not deploy, push, create cloud projects or run SQL against a real DB.

## Design (short form)

- Tokens only (CSS variables in `src/app/globals.css`): `--ink #0B1220` bg, `--surface`, `--surface-2`, `--hairline`,
  `--text`, `--graphite`, `--signal #F5A524` (ONLY: waveform, in-build dot, focus ring, sky label sun glyph, preview
  label), mention chip vars, 6 tile colours.
  No hex anywhere else (sole exception: the sky keyframes in `src/lib/sky/palette.ts`). No #000/#fff.
- Geist Sans; Geist Mono for metadata/numbers/monogram. H1 36/40 500 −0.02em. Section heads 16/500. Body 16/24.
  Card title 14/500, subtitle 14 graphite, mono meta 12 graphite.
- One 768px column; 20px side padding below 808px. Header 64px, not sticky. Section gap 64 desktop / 48 mobile.
- Cards: surface, radius 8, 14×16 padding, hover → hairline border + surface-2 (150ms). Whole card is the link.
- No gradients, glows, glass, bento, illustrations, parallax or scroll fade-ups. **One exception:** the Sylhet Sky
  background (`src/components/sky`, `src/lib/sky`). Gradients and glows are allowed only inside the sky renderer.
  Nothing else gets a decorative gradient. (The chat dock fade is functional, from the original brief, and stays.)
- Motion: waveform, status line, show-more, chat ring/dots, and the sky. Every one has a reduced-motion path.
  Nothing else moves.
- Background stack (all fixed, aria-hidden, pointer-events none), "Sylhet Sky": the real sky over Sylhet right now.
  z −4 CSS gradient (`--sky-zenith/mid/horizon`, set before paint by an inline script, the no-JS and reduced-motion
  fallback) · z −3 WebGL2 atmosphere at 0.5 × DPR (clouds, fog, horizon glow, moon glow, lightning) · z −2 Canvas 2D
  particles (stars, moon, meteors, rain) · z −1 column scrim · z −1 grain. Body is transparent; `<html>` paints `--ink`.
- Sky rules: state comes from sun elevation (suncalc), never clock hour. Every displayed time is Asia/Dhaka via Intl.
  Weather comes only from `/api/sylhet` (server-cached Open-Meteo, 15 min); the browser never calls Open-Meteo.
  The keyframe palette lives in `src/lib/sky/palette.ts` (the only hex outside `globals.css`); retune it only with
  the contrast sweep green (`tests/unit/sky-contrast.test.ts`). `--scrim-a` is solved, never tuned by eye. Amber
  appears in the sky system only as the label's sun glyph at golden hour / civil twilight. Lightning never flashes
  the whole screen. Emit meteors through `emitSky` (`src/lib/signal-bus.ts`), never on scroll. Budget: sky JS ≤ 9 kB
  gzip excluding suncalc, inline first-paint script < 1.5 kB, atmosphere GPU ≤ 2 ms at 1920×1080 DPR 2.
- Accessibility beats design when they conflict; log it.

## Docs

`docs/PLAN.md` (tasks) · `docs/PROGRESS.md` (resume from here) · `docs/DECISIONS.md` · `docs/OPEN_QUESTIONS.md`
