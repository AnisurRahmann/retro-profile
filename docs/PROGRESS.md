# Progress

Branch `redesign/talk-to-my-agent` (off `main` @ 9fb4a5a). Nothing pushed, nothing deployed.

## Done

- Phase 0–2: Next 16 shell, tokens, content model (`src/content.ts` + zod), `/`, `/work/[slug]` ×5, `/lifts`, `/privacy`.
- Phase 3: waveform, rotating status line (pauses on hidden tab, one random line under reduced motion), show-more (`grid-template-rows` 0fr→1fr, `inert` when closed), hover states.
- Phase 4: `/api/chat` (NDJSON stream, ≤2 model calls, ≤1 tool, zod-validated input, same-origin check, abort on disconnect), tools, rules in `src/agent/system.ts`, rate limit 20/h 60/day + daily token budget via atomic Postgres functions, logging via `after()`, `/api/intro` + Resend, migrations with 90-day retention.
- Phase 5: `/chat` (empty state, streaming with 3-dot pulse, Stop, New chat, `?q=` prefill, book/project/intro cards, rate-limit + error fallbacks, kill switch).
- Phase 6: 39 eval cases, deterministic grader + groundedness judge, `pnpm eval:live`.
- Phase 7: metadata, OG images (site + `/chat`), JSON-LD Person, sitemap, robots, SVG favicon, postbuild `[[placeholder]]` guard.

- Signal Field + depth layer (2026-11-25): static depth layer (top light, vignette, grain), an interactive WebGL2 dot field with a CSS fallback, and three defect fixes. See "Signal Field" below.

## Next task

Shakil: fill the open questions below, add `public/shakil.jpg`, then run `pnpm eval:live` (follow-up prompt 2).

## Commands

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (build runs `prebuild` knowledge generation and the `postbuild` placeholder guard)
- `pnpm test:build` — builds, then greps rendered output for `[[...]]`
- `pnpm e2e` — after a build; starts `pnpm start -p 3100` with `CHAT_MOCK=1`
- `CHAT_MOCK=1 pnpm start -p 3100` then `pnpm shots` — screenshots into `.shots/`
- `pnpm eval:mock` — harness on the scripted mock · `pnpm eval:live` — real model (you run this)

## Final checks (2026-11-25)

| Check | Result |
|---|---|
| typecheck / lint | clean, 0 warnings |
| unit (vitest) | 60 passed (after Signal Field) |
| e2e (Playwright) | 23 passed (after Signal Field) |
| build-output `[[` guard | clean |
| Lighthouse mobile `/` | perf 100 · a11y 100 · best practices 100 · SEO 100 · CLS 0 · LCP 0.77 s |
| Lighthouse mobile `/chat` | 100 · 100 · 100 · 100 · CLS 0 |
| Lighthouse mobile `/work/support-agent`, `/lifts` | 100 · 100 · 100 · 100 |
| Home first-load JS (gzip) | **~141 kB, target was 100 kB — missed.** 39 kB polyfill chunk is `noModule` (modern browsers skip it). Of the rest, ~131 kB is the Next 16 App Router + React 19 runtime; site code is ~10 kB. See DECISIONS #35. |
| Knowledge base | ~2.3k tokens (system prompt ~4k). Test fails over 15k. |

Lighthouse was run with no portrait (monogram fallback). Re-run after adding `public/shakil.jpg`; `next/image` with `priority` should keep LCP well under 2.5 s.

### Evals against the mock (`pnpm eval:mock`)

27/39. Forbidden 6/6, injection 6/6, scope 4/4, unknowns 6/6, tools 4/5, facts 1/12. Expected: the mock only scripts tool flows and a default "don't know" reply, so it can't answer facts or call `show_project` for Plaid. It proves the plumbing, not the agent. `pnpm test` gates on the grader and the mock-scripted tool cases (all pass).

Live run not done (no real API calls from this session). Expected cost: Haiku 5.5 at $0.10/$0.50 per 1M in/out, ~4k cached system tokens per turn (cache reads $0.01/1M), ~150 output tokens per turn → roughly $0.0001 per turn, well under $0.001 per conversation. A full 39-case live run plus judges is a few cents.

## Open questions

See `docs/OPEN_QUESTIONS.md` (portrait, Lift / create-mvpkit URLs, Callback AI URL confirmation, Gerald dates, receipts, old routes).

## Visual review

### Pass 1 (Phase 2)
- Case-study flow on mobile: ↓ arrows sat inline left of boxes 2..n, so the first box was out of line. Fixed: arrow on its own row.
- Receipts masonry at 1440: right column ~110 px longer than left (under the 120 px threshold). Re-check when real receipts land.

### Pass 2 (Phase 5)
- Chat project card stretched to the full height of the agent message (`h-full` against a stretched flex item). Fixed: wrapped in a block, half width on ≥640 px.
- Full-page chat captures show the sticky dock mid-page: capture artifact of `position: sticky`, not a layout bug.

### Pass 3 (Phase 7, loop 1)
- Bench cards at 768: the status chip took horizontal space, so "ContentCued" wrapped to four lines and rows went uneven. Fixed: chip moved onto the title line; subtitles get full width.
- Shots script: expanding both "Show N more" buttons by accessible name broke after the first click (name flips to "Show less"). Fixed: target `button[aria-controls]`.

### Pass 4 (Phase 7, loop 2)
- No new defects. Re-ran checks, e2e and Lighthouse; all green.

## Deploy (do these in order; nothing here has been run)

### 1. Supabase
1. Create a project (region near Vercel's function region, e.g. `us-east-1`).
2. Database → Extensions: enable `pg_cron`.
3. Run the migrations in order, either `supabase link --project-ref <ref> && supabase db push`, or paste each file from `supabase/migrations/` into the SQL editor:
   - `20261125000000_chat.sql` (tables, RLS with no policies, `rate_consume`, `budget_available`, `budget_add`)
   - `20261125000100_retention.sql` (`purge_chat_logs` + daily cron at 03:17 UTC)
4. Check: `select * from cron.job;` shows `purge-chat-logs`.
5. Copy the project URL and the **service role** key (Settings → API). The anon key is not used.
   - No pg_cron? Add a Vercel Cron hitting a small route that calls `rpc('purge_chat_logs')`. Not built; ask for it if needed.

### 2. Resend
1. Add and verify the sending domain (`arshakil.com`): add the SPF, DKIM and return-path DNS records Resend shows, wait for "Verified".
2. Create an API key with send-only permission.
3. `INTRO_FROM_EMAIL` = e.g. `Shakil's agent <agent@arshakil.com>`; `INTRO_NOTIFY_EMAIL` = the inbox you read.

### 3. Vercel
1. Project settings: framework **Next.js** (the old project was configured for CRA), build `pnpm build`, install `pnpm install`, Node 22.
2. Environment variables (Production and Preview), from `.env.example`:
   - `ANTHROPIC_API_KEY`
   - `CHAT_MODEL=claude-haiku-5-5`
   - `CHAT_ENABLED=false` for the first deploy
   - `CHAT_DAILY_TOKEN_BUDGET=2000000`
   - `RATE_SALT` = a long random string (`openssl rand -hex 32`)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`, `INTRO_NOTIFY_EMAIL`, `INTRO_FROM_EMAIL`
   - Never set `CHAT_MOCK` in Vercel.
3. Deploy a preview. Check `/`, `/work/*`, `/lifts`, `/privacy`, `/chat` (shows only the book card while disabled), `/opengraph-image`, `/robots.txt`, `/sitemap.xml`.
4. Set `CHAT_ENABLED=true` on Preview, redeploy (the page reads it at build), smoke-test `/chat`: a hiring question → book card; "can he follow up" → intro form → email arrives with reply-to set; 21 quick messages → rate-limit message. Check rows in `chat_sessions`, `chat_messages`, `intros`, `rate_windows`, `daily_budget`.
5. Production: set `CHAT_ENABLED=true`, deploy, then point `arshakil.com` (apex → `www` redirect as today) at the project.
6. Decide redirects for the old `/hire`, blog and `fb-*` URLs before switching DNS (OPEN_QUESTIONS #9).

## Signal Field (2026-11-25)

### Lighthouse, mobile, `/`, production build, same machine
| | runs | perf | TBT (ms) | median TBT |
|---|---|---|---|---|
| Recorded earlier in this file | 1 | 100 | 20 | 20 |
| Before (re-measured, depth layer not yet added) | 3 | 100 · 100 · 100 | 56 · 22 · 24 | 24 |
| After, first version (blocking shader compile) | 3 | 99 · 100 · 100 | 96 · 58 · 28 | 58: **failed** the +20 ms rule |
| After, final (compile polled across tasks) | 5 | 100 × 5 | 45 · 18 · 33 · 22 · 24 | **24 (+0 vs before, +4 vs recorded)** |

Accessibility, best practices and SEO are 100 on all final runs. One earlier run scored accessibility 95 because Lighthouse caught the status line mid-fade (#293141 at 180 ms). That's a sampling flake of the existing status-line transition, not the field.

### GPU time (dev only, `EXT_disjoint_timer_query_webgl2`, Chrome/ANGLE Metal, Apple M2, 8 emitters active)
| Renderer | 3840×2160 (1920×1080 @ DPR 2) |
|---|---|
| Full-screen triangle, as briefed | 4.4–6.6 ms |
| + early exit outside dots | 2.0 ms |
| Empty full-screen pass (floor) | 1.0–1.2 ms |
| **Instanced dots (shipped)** | **1.13–1.25 ms**, of which a clear-only frame is 1.03–1.09 ms (so the dots cost ~0.1–0.15 ms) |
| Instanced dots at 1920×1080 DPR 1 | 0.57 ms |

The < 1 ms target is missed by the surface floor, not by the field: clearing and presenting a 3840×2160 canvas costs ~1.05 ms on this GPU before anything is drawn. Headless Chrome's default SwiftShader doesn't expose the timer; use `scripts/probe/gpu.mts`.

### Bundle
SignalField chunk: 3.6 kB gzip (budget 6 kB). It loads via `next/dynamic` after hydration and initialises in `requestIdleCallback`.

### Defects
1. **Card alignment.** Measured: in each row, a card with a one-line subtitle had its title 10 px lower than its neighbour (e.g. titleTop 439 vs 449), because `.card` used `align-items: center`. Fixed: `align-items: flex-start`, and the tile gets `margin-top: 5px`, computed from Geist's metrics (20 px line, ascent 14, descent 4, cap 9.94) so its top meets the title's cap top. The status chip stays on the title line. A Playwright test now asserts every card has the same title offset and the 5 px tile offset.
2. **Portrait.** Root cause: `public/shakil.jpg` doesn't exist. The path, `next/image` config and fallback condition are correct. The fallback already used Geist Mono (verified computed `font-family: GeistMono`, the same as the header monogram), `--surface-2` and a 1px `--hairline` ring. The file check moved into the render so `pnpm dev` picks the photo up without a restart. Logged in OPEN_QUESTIONS #1.
3. **Top-edge line.** Not in the document. Probed pixel rows y = 0–3 at 1440 wide, DPR 1 and 2, on `/` and `/chat`, in the production build and on the running dev server, before and after the depth layer: every row matches row 10 (flat `#0B1220` before; the smooth top-light gradient after). No element under 4 px tall sits at the top, and after client navigation focus lands on the clicked link with no outline. The line is drawn outside the page: the browser's toolbar/content separator, or the dev overlay. Neither is in production output, so there was nothing in the code to remove (`scripts/probe/top-edge.mts` reproduces the check).

### Visual review (`.shots/signal-field/`, 1440 and 1920, viewport-sized)
- Pass 1: at 1920 the gutters still read as empty at idle, and the cursor glow didn't register in the gutter. Tuned aMin 0.10 → 0.16, rBase 0.8 → 0.9, cursor 0.35 → 0.45 (DECISIONS #39).
- Pass 1: the contrast guard failed at the ripple peak (4.13:1 for `--graphite`). Column mask 0.35 → 0.25; the guard now passes.
- Pass 2: no moiré at DPR 1 (integer 22 px pitch). Amber appears only on ripple crests in the gutters (the column mask keeps column ripples under the amber threshold). The click ripple reads as a single quiet ring that fades before the column. Mid-stream chat emits are visible as faint pulses at the avatar. The column stays calm while reading.
- Full-page shots (`pnpm shots`) show a seam at the first viewport height: Chromium paints fixed layers once in full-page captures. Not a page bug; use the viewport-sized shots for the background.
