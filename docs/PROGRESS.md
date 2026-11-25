# Progress

## Done
- Phase 0–2: Next 16 shell, tokens, content model, static pages (commit 70d4296).
- Phase 4: agent backend (NDJSON /api/chat, tools, guardrails, Supabase limits + budget, logging, /api/intro + Resend, migrations). 36 unit tests.
- Phase 3: waveform, rotating status line (pauses on hidden tab, static under reduced motion), show-more (grid-rows 0fr→1fr, `inert` when closed), hover states. Playwright: 11 passing.

## In progress
- Phase 5: agent UI.

## Next task
- Phase 5: `/chat` page, chat client components, tool cards, intro form.

## Commands
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- `pnpm e2e` (after build) · `pnpm shots` (needs `CHAT_MOCK=1 pnpm start -p 3100`)

## Visual review
### Pass 1 (Phase 2)
- Case-study flow on mobile: ↓ arrows sat inline left of boxes 2..n, so the first box was out of line. Fixed: arrow on its own row, boxes left-aligned.
- Receipts masonry at 1440: right column ~110px longer than left (under the 120px threshold). Left as is; re-check when real receipts land.
- Bench cards at 1440: the status chip squeezes subtitles to two lines. Accepted: rows stay equal height (cards stretch), and moving the chip under the title would break the shared card component.
