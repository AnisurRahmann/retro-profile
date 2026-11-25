# arshakil.com — "Talk to my agent"

Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind 4, pnpm. Branch: `redesign/talk-to-my-agent`. Never touch `main`.

## Commands

- `pnpm dev` · `pnpm build` (prebuild regenerates `src/agent/knowledge.md`) · `pnpm start`
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` — must be green before any commit
- `pnpm shots` — screenshots at 360/768/1440 into `.shots/` (needs `CHAT_MOCK=1 pnpm start -p 3100`)
- `pnpm e2e` — Playwright (starts `pnpm start` on :3100 with `CHAT_MOCK=1`; run `pnpm build` first)
- `pnpm eval:live` — real-model evals. Shakil runs this himself. Never in CI or tests.

## Rules

- ALL copy and data live in `src/content.ts` (zod-validated by `src/content.schema.ts`). Components import from
  `src/site.ts`, which strips unresolved `[[placeholders]]`. No copy in components (a test enforces it).
- The agent's knowledge base is generated from the same file. Edit content, then `pnpm knowledge`.
- Never invent metrics, quotes, dates, logos or links. Never mention relocation, visas, salary, "open to work".
- Server Components by default. `"use client"` only for: status line, show-more, chat UI.
- No UI kits, animation libraries, icon packs or the Vercel AI SDK. Log any new dependency in `docs/DECISIONS.md`.
- Never put real keys anywhere but `.env.local`. Never call the real Anthropic API in tests.
- Do not deploy, push, create cloud projects or run SQL against a real DB.

## Design (short form)

- Tokens only (CSS variables in `src/app/globals.css`): `--ink #0B1220` bg, `--surface`, `--surface-2`, `--hairline`,
  `--text`, `--graphite`, `--signal #F5A524` (ONLY: waveform, in-build dot, focus ring), mention chip vars, 6 tile colours.
  No hex anywhere else. No #000/#fff.
- Geist Sans; Geist Mono for metadata/numbers/monogram. H1 36/40 500 −0.02em. Section heads 16/500. Body 16/24.
  Card title 14/500, subtitle 14 graphite, mono meta 12 graphite.
- One 768px column; 20px side padding below 808px. Header 64px, not sticky. Section gap 64 desktop / 48 mobile.
- Cards: surface, radius 8, 14×16 padding, hover → hairline border + surface-2 (150ms). Whole card is the link.
- No gradients (except the chat dock fade), glows, glass, bento, illustrations, parallax or scroll fade-ups.
- Motion: waveform, status line, show-more, chat ring/dots. Every one has a reduced-motion path. Nothing else moves.
- Accessibility beats design when they conflict; log it.

## Docs

`docs/PLAN.md` (tasks) · `docs/PROGRESS.md` (resume from here) · `docs/DECISIONS.md` · `docs/OPEN_QUESTIONS.md`
