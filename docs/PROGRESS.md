# Progress

Branch `redesign/talk-to-my-agent` (off `main` @ 9fb4a5a). Nothing pushed, nothing deployed.

## File map

Which file does what (as found by grep, 2026-11-26). Paths are relative to the repo root.

- Copy and data
  - `src/content.ts`: all copy and data. `profile.statusLines` is the rotating status line; `ui.sky` is the sky label's copy.
  - `src/content.schema.ts`: the zod schemas (`profileSchema.statusLines`). `src/site.ts`: the placeholder-stripped view components import.
- Page and styles
  - `src/app/(site)/page.tsx`: the home page: the sky stage with the hero (name, status line, one-liner, label), the sections, the closer, the closing scene slot `[data-sky-scene=closing]`.
  - `src/app/layout.tsx`: the root layout: the inline first-paint script, `SkyBackdrop`, the header.
  - `src/app/globals.css`: tokens and all sky CSS: `.sky-stage`, `.sky-scene*`, `--stage-h`, `--scene-h`, `--band-h`, `[data-on-sky]` (halo and chip), `.status-line`.
- Hero
  - `src/components/StatusLine.tsx`: the rotating status line.
  - `src/components/sky/SkyStage.tsx`: the stage section (`[data-sky-stage]`), the stage scene slot, the hero wrapper `[data-sky-hero]`, drag-the-sky, the first-visit time-lapse.
  - `src/components/sky/SkyLabel.tsx`, `SkyStrip.tsx`, `SylhetClock.tsx`, `SkyGlyph.tsx`: the time · weather · place label, the sun-path strip (on phones the 44px arc handle), the clock, the glyphs.
- The sky background
  - `src/components/sky/SkyBackdrop.tsx`, `SkyMount.tsx`: the fixed layer stack; the renderer is lazy-loaded after idle.
  - `src/components/sky/SkyController.tsx`: fetches `/api/sylhet`, paints the CSS gradient, sets the label's place.
  - `src/components/sky/SkyRenderer.tsx`: the canvas renderer: atmosphere, particles, the landscape bands (fixed band, stage scene, closing scene), their lighting, the take-off trigger, the `window.__sky` test hooks.
  - `src/components/sky/landscape.ts`: draws one landscape band (layer strips, rims, tea rows, the city glow, the ground fade).
  - `src/components/sky/life.ts`: what lives between the layers: windows, lamps, runway lights, the airport, the plane and its take-off.
  - `src/components/sky/particles.ts`: stars, the moon, meteors, rain. `bodies.ts`: the sun sprites, the dotted arc, `drawHalo` (the 22° ring).
  - `src/components/sky/atmosphere.ts`, `sky-shader.ts`, `cloud-field.ts`, `ambient.ts`, `hooks.ts`: the WebGL2 sky, its shader, the CPU cloud mirror, birds / planes / fireflies / rickshaw, shared hooks.
- Text backing
  - `src/lib/sky/backing.ts`: the model (`decide`, `HALO_CURVE`, the chip's alpha). `src/components/sky/backing-runner.ts`: writes `data-backing`, `--halo-a`, `--chip-a` on each `[data-on-sky]` element.
- Sky maths (`src/lib/sky/`)
  - `arc.ts`: the sun/moon arc, `stageHeightFor`, `SCENE_HORIZON`. `view.ts`: live page geometry. `horizon.ts`: where the horizon is on screen.
  - `store.ts`: the sky store, the `?sky` / `?wx` overrides, `SKY_DEBUG`. `first-paint.ts`: the inline first-paint script.
  - `model.ts`, `gradient.ts`, `palette.ts`, `astro.ts`, `time.ts`, `scrub.ts`, `weather.ts`, `color.ts`: the sky model, colours, the keyframe palette, astronomy, Dhaka time, time travel, the weather shape, colour maths.
- Landscape (`src/lib/sky/landscape/`)
  - `anchors.ts`: parallax, landmark anchors, `landMode`, `sceneBand`, the scene walks. `world.ts`: `buildWorld` (the fixed band), `buildStageScene`, `buildClosingScene`.
  - `shapes.ts`: the silhouettes as SVG path data. `plane.ts`: the plane, its take-off path, `planePx`, `createArrival` (the arrival trigger).
  - `colors.ts`: layer colours, `teaRowColor`, `sunLight`. `lights.ts`: window schedules, the city glow alpha.
- Tests and tools
  - `tests/unit/sky-*.test.ts`: arc, plane, landscape, horizon, contrast, render, gradient (incl. the first-paint script).
  - `tests/e2e/sky.spec.ts`, `sky-backing.spec.ts` (the pixel gate), `sky-nowebgl.spec.ts`, `pixels.ts`.
  - `scripts/check-bundle.ts` (the budgets), `scripts/shots-sky.ts`, `scripts/probe/` (review shots and probes).

## v5.1 resume (2026-11-26)

Branch `fix/sky-v5.1`, off `main` @ 3cb5d0d (pulled: already up to date with `origin/main`). Nothing pushed, nothing deployed.

### Step 0: why the earlier work wasn't showing

The v5 tasks were never done. `git log --all --grep='fix(sky)'` finds only `384bbd4 fix(sky): column scrim band (D2)` (an older fix); no commit on any branch, no stash (`git stash list` is empty), no other worktree mentions T1–T10. The three dangling commits `git fsck` reports are unrelated: an old weather-test fixup (25 Nov 08:27), the pre-amend copy of `73a0b81` (a landed commit) and a September stash. There is no `.shots/v5*` folder either, so the earlier run left no evidence. localhost:3000 showed the old behaviour because that is what `main` does.

The dev server on :3000 (started 03:37, from this checkout) was stopped by port, `.next` was deleted and `pnpm dev` restarted, as instructed. Evidence shots come from a second `pnpm dev` on :3005 with `WEATHER_MOCK=1 CHAT_MOCK=1` (dist dir `.scratch/next-dev`, git-ignored), so no screenshot run calls Open-Meteo. Next adds that dist dir's types to `tsconfig.json` on start; that edit is kept out of every commit.

Baseline before any change: typecheck and lint clean; vitest 232 passed, 2 skipped. Shots in `.shots/v5.1/baseline/` confirm each reported problem: at 375×812 the `h1` starts at y = 271.5, the stage scene is 150px, the status line is `white-space: normal`; at 1440×900 the footer (viewport y 815–900) sits on the 162px landscape band (y 738–900); on the phone the closer ends at y 415, the closing scene runs 463–663 and the footer starts at 727.

### Task log

One line per "Done when" item. PASS / FAIL are from the code and a fresh screenshot; nothing is carried over from an earlier run.

#### T1 · status line never wraps on mobile

- PASS: at 375×812 all 7 short lines are one line each. Waited through one full rotation and measured every line as it finished typing: 24px tall, `white-space: nowrap`, none truncated (widest "Reviewing every agent diff." 194.6px of about 305px available). `tests/e2e/site.spec.ts` now re-checks all 7 in the suite.
- PASS: no gap over 12px between the status line and the one-liner: 4px on every line (the phone reserve above the one-liner went from 48px to 24px).
- From 640px up the full lines stay, 28px, one line (`t1-1440x900-wide.png`).
- Shots (11:00 partly cloudy): `.shots/v5.1/T1/t1-375x812-line1.png`, `t1-375x812-line4.png`, `t1-375x812-line6.png`, contact sheet `sheet.png`, `t1-1440x900-wide.png`.
- How: `statusLinesShort` in `src/content.ts` (schema: one per line, same order); `StatusLine` renders both variants and CSS shows one, so there is nothing to choose after hydration; `.status-line` has a fixed one-line height and `.status-line-text` is nowrap / overflow hidden / ellipsis. DECISIONS #109.

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

## Sylhet Sky v2 (2026-11-25)

Sun on a visible day arc, the sky stage, time travel, walking through Sylhet, slow life, mobile. Nine commits from `feat(sky): sky stage layout` to `test(sky): v2 …`. Rules: CLAUDE.md "Design"; decisions #86–100.

### Checks
| Check | Result |
|---|---|
| typecheck / lint | clean |
| unit (vitest) | 197 passed: arc mapping (endpoints, clamp, solstice apex), moon times, timeAtDrag + easings, window schedules, firefly counts, anchor solver, drift minimum, contrast sweep (+ sun behind the column, the mobile hero with the sun, the landscape band) |
| e2e (Playwright) | 46 passed, two runs in a row: strip (keyboard + drag), drag the sky, phone swipe (vertical scrolls, sideways scrubs), time-lapse (once per session, cancels, skipped under reduced motion and ?sky), place names, take-off, reduced motion (fps 0, no parallax), loop caps, layers |
| Contrast sweep | column `--graphite` worst **4.51:1** (8° fog dusk, bottom, 0.82 cap) · hero `--on-sky`/`--text` worst 6.50 / **7.50:1** · landscape band `--graphite` worst **4.50:1** |
| Scrolling (1440×900, real GPU) | 60.0 fps, frame gap p95 16.7 ms, max 16.8 ms; 0 tasks > 50 ms (longest 23 ms) — `scripts/probe/scroll-trace.mts`, trace in `.shots/sky-v2/scroll-trace.json` |
| Scrim edge (`scrim-edge.mts`) | side-band luminance kink with/without scrim: 11:00 partly 5.9 / 3.2 ‰L, 16:45 clear 5.3 / 4.0 ‰L: a smooth ramp, no line |
| Sky JS | lazy renderer 22.6 kB gzip, eager 12.9 kB (budget broken, #95) |

### ms/frame (Apple M2, ANGLE Metal; GPU = atmosphere pass, timer query; CPU = renderer main-thread time; two runs each)
| state | 1920×1080 DPR 2 GPU | CPU | 375×812 DPR 3 GPU | CPU |
|---|---|---|---|---|
| 16:45 clear | 0.93–1.93 | 0.39–0.59 (scrolling 0.25–0.44) | 0.41–0.71 | 0.32–0.60 |
| 21:00 thunder | 0.60–1.43 (forced bolt 0.67–1.28) | 0.69–0.95 | 0.39–0.57 | 0.55–0.96 |
First frame after load (strip and sprite builds) up to 26 ms; worst steady frame 4.2 ms.

### Lighthouse, mobile (Lighthouse 13.6, Playwright Chromium, same machine/session, production build, `WEATHER_MOCK=1`)
| `/` | perf | LCP | TBT | CLS |
|---|---|---|---|---|
| before (ba931b8) | 79 (cold) · 100 · 100 · 100 · 100 · 100 | 0.76 s | 27–58 ms (947 cold) | 0 |
| after | 98 · 100 · 100 · 100 · 100 · 100 | 0.76–0.78 s | 40–180 ms | 0 |
`/chat` after: 97 · 100 · 100. A11y, best practices and SEO 100 on every final run. LCP element: the hero status line, before and after. Two intermediate runs found CLS 0.0015 and 0.008 (weather wrapping the label, then "preview" widening the line during the time-lapse): fixed by reserving the label's second line under 480px and overlaying the preview (#94). One intermediate run scored a11y 96: axe caught the status line mid-fade (pre-existing rotation; not reproduced in the final six).

### D1–D5
- **D1 no sun:** a limb-darkened, altitude-coloured sun with blooms, corona and breathing on a dotted arc, through cloud by the CPU cloud field, rays at golden hour, a shimmer on the river near the horizon.
- **D2 scrim band:** the scrim starts below the stage (open sky above), its sides are a 220px smootherstep, no cloud damping band, and its alpha comes from the measured sky. Measured kinks are smooth ramps. The column is still darker than the gutters by day (graphite over the noon sky needs ~0.6 ink): a soft lane, not an edge.
- **D3 mobile:** no column sides below 808px, open stage with a compact hero, stars ≥ 1/2,200 px² × 1.25 ≥ 0.35 alpha, the moon on the arc inside [8%, 92%] and above the hero.
- **D4 hidden scrubber:** an always-visible sun-path strip, drag the sky, and a once-per-session time-lapse with a hint.
- **D5 frozen clouds:** minimum drift 5/3 px/s and a field that keeps changing shape.

### Constants
Arc: east 6% / west 94% of the width at stage bottom − 8% of the viewport height (mobile: 20px above the hero), apex header + 28 = 92px, x = ½ − 0.44·cos πu, height = alt / max × sin(max) / sin(88.5°), discs in [8%, 92%]; sun r 16 / 13, moon 14 / 12. Parallax L1 0.04 · L2 0.15 · L3 0.45 · L4 0.9 · sky 0. Landmarks centre at section top = 40%. Band 18vh / 14svh, 110–200px; depths 0.25 / 0.45 / 0.7 / 0.95.

### Visual review (`pnpm shots:sky` → `.shots/sky-v2/`, 8 states × 1440/375 × top / Shipped / closer, `life=1`)
- **Round 0 (building):** hero scrims read as dark cards (box, then hard ellipse) → `--on-sky` + wide elliptical feather; the guard's golden-cloud estimate was ~2× too bright → composited like the shader; the sun was a flat disc → fatter blooms; mobile sun sat on the hero text → horizon above the hero; river read as a road → lighter, with a bank reflection; the parked rickshaw read as a "C" → redrawn with seat, hood and frame; foreground stood below the near bank → lifted onto it; landmarks overlapped when sections are close → placed left to right; the closer couldn't reach 40% → anchors clamped.
- **Round 1:** sun and moon shone through 100% heavy-rain and storm decks → occlusion thickened by rain and full cover; night silhouettes vanished into the sky → a city glow behind the band (deep night only, in the sweep); the golden sun still read flat → hotter centre, stronger limb darkening, bloom plateau. Bridge (bowstring trusses on piers) and the clock tower (plinth, shaft, face, dome, finial) read at a glance; tea rows, shade trees, water tanks and the mobile tower read as a paper-cut skyline.
- **Round 2:** heavy rain: the sun is a faint patch; thunder: the moon hidden; night skyline readable; sun has a hot core, limb darkening and halo (`03-1645-clear-1440-top.png`).
- **Round 3 (final shots):** mobile heavy rain showed the sun through a gap in the rain deck (`07-1400-heavy-rain-375-top.png`) → a rain deck has no gaps (shader + mirror); reshot, fixed.

### Open
- The lane: by day and at golden hour the column is clearly darker than the gutters, now as a soft gradient. It's the cost of `--graphite` body text over a mid-blue/amber sky (#89). Lightening `--graphite`, or glass backings for the bare-sky text, would let it go.
- On desktop a landmark is centred *behind the cards* when its section is at 40% (as briefed), so it's mostly seen passing through the gutters (`03-1645-clear-1440-shipped.png`).
- Night: the landscape is quiet by design; silhouettes read only against the city glow (`05-2030-clear-1440-closer.png`).
- Bundle budget (#95).
