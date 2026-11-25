# Progress

Branch `redesign/talk-to-my-agent` (off `main` @ 9fb4a5a). Nothing pushed, nothing deployed.

## Done

- Phase 0–2: Next 16 shell, tokens, content model (`src/content.ts` + zod), `/`, `/work/[slug]` ×5, `/lifts`, `/privacy`.
- Phase 3: waveform, rotating status line (pauses on hidden tab, one random line under reduced motion), show-more (`grid-template-rows` 0fr→1fr, `inert` when closed), hover states.
- Phase 4: `/api/chat` (NDJSON stream, ≤2 model calls, ≤1 tool, zod-validated input, same-origin check, abort on disconnect), tools, rules in `src/agent/system.ts`, rate limit 20/h 60/day + daily token budget via atomic Postgres functions, logging via `after()`, `/api/intro` + Resend, migrations with 90-day retention.
- Phase 5: `/chat` (empty state, streaming with 3-dot pulse, Stop, New chat, `?q=` prefill, book/project/intro cards, rate-limit + error fallbacks, kill switch).
- Phase 6: 39 eval cases, deterministic grader + groundedness judge, `pnpm eval:live`.
- Phase 7: metadata, OG images (site + `/chat`), JSON-LD Person, sitemap, robots, SVG favicon, postbuild `[[placeholder]]` guard.

- Signal Field + depth layer (2026-11-25): static depth layer (top light, vignette, grain), an interactive WebGL2 dot field with a CSS fallback, and three defect fixes. See "Signal Field" below. **Replaced the same day by Sylhet Sky.**
- Sylhet Sky (2026-11-25): the real sky over Sylhet as the background (sun, moon, live weather), the hero label with a day scrubber, the `sylhet_now` agent tool. See "Sylhet Sky" at the end.

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

## Review fixes (2026-11-25, localhost:3000 review)

### 1. `/api/chat` 503 `unavailable`: root cause
There is no `.env.local` in the repo, so the dev server had no `ANTHROPIC_API_KEY` and no `CHAT_MOCK`. In `src/app/api/chat/route.ts`, `getAdapter()` returned null and the route returned 503 `unavailable` on line 56, before rate limiting. Adding only the key would have hit the second wall: `consume()` in `src/server/limits.ts` returned `unavailable` because Supabase wasn't configured outside mock mode. The page only checked `CHAT_ENABLED` (unset → enabled), so it rendered a working input.
Fixed with `getChatAvailability()`, shared by the page and the route (DECISIONS #49–53). With the current env, `/chat` now renders the kill-switch state, and `pnpm dev` logs at startup: `[chat] unavailable (missing_env): ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RATE_SALT`.
To run the real agent locally, `.env.local` needs `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `RATE_SALT` (≥ 16 chars), with the migrations applied to that Supabase project. Optional: `CHAT_MODEL`, `CHAT_DAILY_TOKEN_BUDGET`, plus `RESEND_API_KEY`, `INTRO_NOTIFY_EMAIL`, `INTRO_FROM_EMAIL` for intros. To try the UI without any services: `CHAT_MOCK=1 pnpm dev`.

### 2. Focus rings
Mouse focus on the composer changes only its border (`color-mix(graphite 45%, hairline)`). The amber 2px ring appears only for keyboard focus, gated by an input-modality flag because browsers match `:focus-visible` on text fields even on click (DECISIONS #54). Playwright covers mouse vs Tab on the composer, a button and the intro fields.

### 3–4. Signal Field tuning and idle modes
Constants before → after: aMin 0.16 → 0.16 (already raised last round; reads clearly, not busy), rBase 0.9 → 1.0, idle 0.06 → 0.09. The column mask stays 0.25 (the contrast guard fails at 0.35). Ambient/interactive emitters with per-emitter τ, plus the activity rule A·e^(−Δt/τ) > 0.02: the home page now runs ambient at 30fps and drops to idle (15fps) between status lines; /lifts settles to idle. Review shots at 1440/1920 idle (pointer never entered): the gutter grid is clearly perceptible and stays behind the cards.

### 5. GPU at Retina (1920×1080, DPR 2, Apple M2, ANGLE Metal, dev timer query)
| backing scale | busy (8 ripples) | rest |
|---|---|---|
| 2.0 (before) | 0.75–0.89 ms | 0.90–1.10 ms |
| **1.5 (shipped)** | **0.54–0.75 ms** | **0.53–0.61 ms** |
| 1.0 | 0.68–0.98 ms (GPU down-clocked) | 0.34–0.40 ms |
1.5 chosen: 1.0 visibly softens bright dots at 400%, 1.5 doesn't (DECISIONS #58). The review's projection of 2–5 ms assumed the full-screen fragment shader; the instanced renderer (DECISIONS #42) already kept DPR 2 near 1 ms.

### Lighthouse, mobile, production build (3 runs each)
| page | before (perf · TBT ms) | after (perf · TBT ms) |
|---|---|---|
| `/` | 99/100/100 · 107/30/32 (median 32) | 100/100/100 · 56/37/40 (median 40) |
| `/chat` | 100/100/100 · 48/33/59 (median 48) | 100/100/100 · 35/44/45 (median 44) |
Accessibility, best practices and SEO are 100 on every after-run; CLS 0. `/chat` is now rendered per request (DECISIONS #50) with no measurable cost.

### Review shots (375 / 1440 / 1920)
`/`, `/chat` empty, kill-switch (`CHAT_ENABLED=false`) and mid-stream with the mock: no horizontal scroll, the kill-switch state always offers the book card and email, and the mid-stream list no longer flashes an empty bullet. One false alarm in the first pass: a stale `next start` kept serving the old build's chunks (404s, no hydration), so the streaming shot showed the empty state. Restarted cleanly and reshot.

### Unchanged
Card titles align per row (e2e), the status line rotates about every 3.2 s, click ripples render, the canvas is aria-hidden / pointer-events none / z-index −1 (e2e), no horizontal scroll at 375px (e2e), theme-color `#0B1220` (e2e). `public/shakil.jpg` is still missing; the fallback stays (OPEN_QUESTIONS #1).

## Sylhet Sky (2026-11-25)

Replaces the Signal Field. Ten commits from `refactor(bg): remove the Signal Field` to `test(sky)`. Architecture and rules: CLAUDE.md "Design"; decisions #61–85.

### Checks
| Check | Result |
|---|---|
| typecheck / lint | clean |
| unit (vitest) | 175 passed (WMO codes, OKLab, solstice geometry, sunrise vs Open-Meteo, first-paint script, contrast sweep, lightning, sylhet_now) |
| e2e (Playwright) | 36 passed, two full runs in a row (11 new sky tests) |
| `pnpm eval:mock` | the 3 new `availability` cases pass on the mock; `tool-show-project` fails as before (mock not scripted for it) |
| Contrast sweep | −30°…90° × 8 conditions × dawn/dusk × 65 heights (+ moon at night): worst `--graphite` **4.64:1**, `--text` 11.47:1, at 8° fog dusk, bottom edge, scrim at its 0.82 cap |
| First-paint script | 1,483 B production (+~120 B `?sky=` parser in dev/test builds); NOAA elevation within 0.41° of suncalc over 2026 |
| Sky JS (esbuild, gzip, excl. suncalc/React) | renderer 8.8 kB (lazy) · controller + label 7.9 kB · unique total 13.4 kB (#80) |
| GPU, atmosphere, 1920×1080 DPR 2, M2 | state 5: 1.42–1.61 ms · state 8: 1.42–1.72 ms (texture noise, 4 octaves, 0.4 × DPR; #83) |

### Lighthouse, mobile (bundled Lighthouse, Playwright's Chromium, same machine, same session)
| page | before (Signal Field build f666c26) | after |
|---|---|---|
| `/` | perf 96 · 97 · 97; TBT 57/39/31; LCP 2.67–2.76 s | perf 92 · 96 · 96 · 96 · 94 · 96 (median 96); TBT 94/37/33/40/20/29; LCP 2.81–3.17 s (median 2.82) |
| `/chat` | 96 · 96 · 96; TBT 31/32/34; LCP 2.81–2.82 s | 94 · 96 · 96; TBT 28/31/33; LCP 2.82–3.01 s |
A11y, best practices and SEO are 100 on every run; CLS 0.000 everywhere. The LCP element is still the hero text (status line on `/`, the sub on `/chat`). **Two of six `/` runs scored under 95 (92, 94)**; median 96. The absolute LCP (~2.7 s) is this session's Lighthouse/throttling setup, not the site: the same tool gives the old build 2.7 s too (the 0.77 s recorded above came from a different setup). `/` LCP moved +0.14 s at the median.

### Visual review (`pnpm shots:sky` → `.shots/sky/`, 10 states × 1440/375 × `/` and `/chat`)
- **Round 0 (building):** partly cloudy showed one blob (fbm too flat) → stretched fbm ×1.9 and smaller cloud scale. Day clouds were invisible (tinted like the sky) → greyed halfway, tops +12% L. Fog read as pink overcast → fog thins cloud alpha by 60%. The crescent moon showed through a 100% storm deck → hidden under full cover.
- **Round 0, contrast:** the brief's golden horizons failed the sweep at the 0.82 cap (4.19:1) → retuned (#70). One scrim for the whole height made a dark lane from top to bottom → per-height scrim stops (#71), clouds/glow at 50% behind the column (#72), eased edge fade (#73).
- **Round 1:** state 1 (night): stars natural, varied, no moon (correct: the 15 Dec waxing crescent has set by 02:00), dim header dot. State 7 (17:35): violet civil dusk into night, first stars. State 3 (06:25): dusty-rose dawn, glow bottom-left. State 8: storm deck with forced lightning (subtle by design: +0.12 L on clouds only), rain reads as rain, not static. State 10 (June monsoon noon): grey-blue rain deck. State 5: overcast deck drifts 9 px/s to the SW (measured diff between frames 1 s apart). **State 6 (dusk): amber over navy, not brown, but the column scrim is clearly visible as a darker lane in the lower half, and on 375 px the whole lower sky is dimmed** (the column is the full width). That's graphite text over an amber horizon: it needs ~0.8 ink. Tried tinting the scrim with the zenith colour instead of `--ink` (reads as deeper sky): fails the gate (3.34:1 in day/fog), reverted. Accessibility wins; logged as the main open trade-off.
- **Round 2 (after the GPU changes):** texture noise at 0.4 × DPR: clouds keep their structure; dusk wisps, overcast deck and storm unchanged in character.

### Open
- The dusk lane (above). Options if it bothers you: accept; or lighten `--graphite` (a token change, needs the token tests); or put the bare-sky text (section heads, "Show N more", closer, footer) on small glass backings and drop the column scrim. Each is a design call, not a bug.
- Open-Meteo commercial status (OPEN_QUESTIONS #13).
- `pnpm eval:live` should include the 3 `availability` cases (real model; Shakil runs it).
