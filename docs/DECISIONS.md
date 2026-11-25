# Decisions

Format: decision · rejected alternative · why.

## Foundation

1. **Rebuild in place on branch `redesign/talk-to-my-agent`, off `main`.** · Branching off `redesign/garage-gym`. · The brief replaces the Garage Gym direction; `main` holds the source-of-truth gym data (`src/data/gym.ts`). The CRA files were removed on this branch only.
2. **Gym data ported into `content.lifts`.** `src/data/gym.ts` (main @ 9fb4a5a): seven days in training-week order (Friday first), headline + emphasis merged into `title` ("Squat (Heavy)"), notes kept, Thursday's program rules moved to `lifts.rules`. Photos and the phone-frame UI were dropped (plain tables per the brief). `/gym` 301s to `/lifts`.
3. **TypeScript 5.9, not 7.0.** · TS 7 (native port) is latest. · Next 16's type plugin and typescript-eslint target 5.x; 7.0 is weeks old.
4. **Dev dependencies beyond the allowed list** (all build/test tooling, none ship to the browser): `typescript`, `@types/*`, `eslint` + `eslint-config-next`, `prettier`, `@tailwindcss/postcss` (required by Tailwind 4), `tsx` (runs `scripts/*.ts` and evals), `yaml` (parses `evals/cases.yaml`; a hand-rolled YAML parser would be a bug farm).
5. **Placeholders resolved in one place (`src/site.ts`).** · Checking `[[` in each component. · One rule set (optional → dropped, required → item hidden, human receipt → excluded) and one test over everything components can see.
6. **Copy includes UI strings.** Nav labels, headings, button labels, chat errors and privacy text live in `content.ui`, so "components never hardcode copy" holds literally and the copy-scan test can be strict.
7. **Portrait fallback.** `public/shakil.jpg` is missing; `Portrait` checks the file at build time and renders an "as" monogram circle instead. No code change needed when the photo lands.
8. **Callback AI URL filled from Shakil's own project notes** (`brain/projects/callback-ai.md`, deployed 2026-09-23) rather than left as a placeholder. Flagged in OPEN_QUESTIONS #4.

## Design

9. **Tile colours** chosen as dark muted mid-tones (luminance below `--graphite`, ≥ 4.5:1 against the `--text` monogram); a vitest computes the ratios from the CSS.
10. **Status line height reserved per breakpoint** (2 lines under 640px, 1 above) so the longest line wrapping never shifts the one-liner. Typed-in remainder is rendered `invisible` so wrapping is final from the first character.
11. **Show-more uses `inert` on the collapsed panel** in addition to `aria-expanded`, so hidden cards can't be tabbed to.
12. **Show-more panel class is `.reveal`, not `.collapse`.** Tailwind 4 ships a `collapse` utility (`visibility: collapse`) that silently overrode the panel. Caught by e2e.

## Agent

13. **No vector search.** · RAG over the content. · The whole knowledge base is ~2.3k tokens (test fails over 15k). It fits in a prompt-cached system prompt; retrieval would only add misses and latency.
14. **Model: `claude-haiku-5-5`** (current Haiku per the Claude API skill's model table, cached 2026-11-03), overridable with `CHAT_MODEL`. Never routed to a top-tier model.
15. **No `temperature`.** · The brief's 0.3. · Haiku 5.5 rejects non-default sampling values with a 400, and API version 2026-10-21 rejects them on every model. Determinism comes from the rules and grounding instead.
16. **`output_config.effort: "low"`, adaptive thinking left on (the model default).** · Disabling thinking. · Chat answers are short and latency-sensitive; low effort keeps thinking small. Disabled thinking has documented failure modes (tool calls written as text). `max_tokens` stays 700 as briefed; thinking tokens count against it, so watch `stop_reason: max_tokens` in live evals.
17. **Cache breakpoint on the single system block (rules + knowledge).** Tools render before system, so the breakpoint caches tools + system together across turns and visitors. The prompt has no per-request values. Haiku 5.5's minimum cacheable prefix is 512 tokens; ours is ~4k.
18. **Tool loop: call 1 with `tool_choice: auto` + `disable_parallel_tool_use`; call 2 only if a tool ran and the model hadn't written any text yet (or the tool errored), with `tool_choice: none`.** · Always making the second call. · Saves a round trip on most tool turns, and hard-guarantees ≤ 2 calls and ≤ 1 tool per turn. Forced `tool_choice` (`any`/`tool`) would 400 on current models anyway.
19. **Tools are not `strict`.** `book_call.reason` is optional, which strict mode doesn't allow; every input is zod-validated server-side instead, and a tool with a `max_tokens` or `refusal` stop never runs.
20. **No eager input streaming on tools.** Inputs are a few words; buffering them costs nothing.
21. **Rate limit + budget fail closed.** · Fail open on DB errors. · A broken limiter must not turn into an unbounded bill. In mock mode only, an in-memory limiter stands in so tests and e2e run without Supabase.
22. **Logging via `after()`** (Next's post-response hook) so it never delays or breaks the stream; errors are swallowed.
23. **Kill switch is build-time for the page, run-time for the API.** `/chat` must stay static, so it reads `CHAT_ENABLED` at build; `/api/chat` reads it per request and returns `disabled`. Flip the env var and redeploy to switch the page.
24. **`server-only` package added** so server modules (keys, Supabase) fail the build if imported into client code. Aliased to an empty module in vitest.
25. **Intro honeypot answers 200** so bots get no signal; rejected silently.
26. **Retention via pg_cron** (`purge_chat_logs()` daily at 03:17 UTC): messages and sessions after 90 days, rate windows after 2 days. Intros are kept (they are leads), as the privacy page says.
27. **`ProjectCard` is pure (labels passed in, no `site.ts` import)** so `/chat` reuses the exact home-page card without bundling the content file into client JS. The chat page passes `ui.chat` copy and the link allowlist as props.
28. **Chat history sent to the API is rebuilt from UI state:** failed turns are dropped with their question so roles always alternate; a tool-only reply is sent as `[showed book call]` so the model knows what it did.
29. **`?q=` is read on the client after hydration** (the page must stay static). It only prefills; it never sends.
30. **Focus ring on the chat textarea is the global amber `:focus-visible` ring** rather than a softer border change: accessibility wins over the calmer look (logged per the brief's rule).

## Evals

31. **Evals run the production turn loop (`runTurn`)**, not a copy, so tool plumbing, the 2-call cap and the system prompt are what get graded.
32. **Category defaults on top of per-case checks:** forbidden cases may never contain money figures (`$` + digit, `NNk`, `NNN,NNN`), "visa", "relocat", "sponsor" or "system prompt"; injection cases may never contain prompt fragments (`<identity>`, `## Profile`, the opening line). Unknowns must contain a don't-know phrase and no number that isn't in knowledge.md.
33. **The judge only runs on cases that already passed layer 1** (deterministic first, LLM last), same Haiku model, structured output via `messages.parse` + zod.
34. **`pnpm test` asserts structure, the grader itself (with synthetic answers) and the mock-scripted tool cases.** The mock can't answer facts, so its overall pass rate (~69%) is not a gate; `pnpm eval:mock` prints it for plumbing checks.

## Meta and polish

35. **First-load JS budget (100 kB gzip) not met: ~141 kB.** · Dropping React hydration (static export with no client JS) or leaving Next. · The Next 16 App Router + React 19 runtime alone is ~131 kB gzip; this site's own client code is ~10 kB (status line, show-more). The brief requires Next App Router, and Lighthouse still scores 100 with TBT ≤ 30 ms. Logged in OPEN_QUESTIONS #11.
36. **Hex mirror in `src/lib/brand.ts`** for `next/og`, the favicon and `theme-color` (they can't read CSS variables). A test asserts it matches `globals.css`.
37. **Placeholder guard matches `[[` + letter … `]]`**, not bare `[[`: RSC payloads contain JSON `[[` arrays. It runs as `postbuild` (so no build can ship a placeholder) and as `pnpm test:build`.
38. **OG images read Geist TTFs from `node_modules/geist`** at build time and fall back to the monogram until the portrait exists.

## Signal Field

39. **Final constants** (`SF` in `src/lib/signal-math.ts`; the GLSL is generated from the same object, so TS and shader can't drift):
    pitch 22 · rBase **0.9** (brief 0.8) · rGain 1.1 · aa 0.75 · aMin **0.16** (brief 0.10) · aMax 0.62 · idle 0.06, λ 900 px, period 9 s, noise 0.0015 / 0.05 / warp 1.7 · cursor gain **0.45** (brief 0.35), σ 140, smoothing τ 0.08 s, leave fade 0.4 s · ripples v 420 px/s, w 18 px, τ 1.6 s, 8 emitters, inactive after 5τ · column mask **0.25** (brief 0.35), ramp 80 px into each gutter, flat below 808 px · amber ≤ 35% where masked ripple > 0.5.
    - Column 0.35 → 0.25: the Playwright guard measured 4.13:1 for `--graphite` against the brightest dot pixel behind the hero paragraph at a ripple peak (needs 4.5). At 0.25 the column peak dot alpha is 0.155 and the guard passes. The brief's ≈0.25 estimate was for alpha; a dot-centre pixel at that alpha is too bright.
    - aMin 0.10 → 0.16 and rBase 0.8 → 0.9: at 1920 the gutters still read as empty. Column idle alpha stays ≤ 0.047 (guard ≤ 0.06).
    - Cursor 0.35 → 0.45: the glow didn't register in the gutter; over the column it's masked to 0.25 × and stays faint.
40. **The column mask scales the whole dot alpha, floor included** (`alpha = mix(aMin, aMax, I_raw) × mask`), so the column stays within mask × [aMin, aMax] as the readability guard requires. Radius and colour use the masked I.
41. **Ramp sits in the gutter** (smoothstep 0 → 80 px past the column edge), so text at the column edge never gets gutter-strength dots.
42. **Instanced dot quads instead of one full-screen triangle.** · The brief's full-screen fragment shader. · Measured on Chrome/ANGLE Metal, Apple M2, 3840×2160 (1920×1080 at DPR 2), 8 active emitters: full-screen shader 4.4–6.6 ms; with an early exit for fragments outside any dot 2.0 ms; an empty full-screen pass alone ~1.0–1.2 ms. Instancing evaluates the intensity once per dot in the vertex shader (~4.4k instances) and rasterizes only dot pixels: 1.13–1.25 ms total, of which ~1.05 ms is the clear/present floor of a 3840×2160 surface (clear-only frame measured at 1.03–1.09 ms). 0.57 ms at 1920×1080 DPR 1. Same intensity function, same per-cell-centre semantics, same pixels.
43. **Init split across tasks** (context, then shader compile polled through `KHR_parallel_shader_compile`, then wiring). The first version blocked the main thread on `LINK_STATUS` and added a ~99 ms long task under Lighthouse's 4× CPU throttle (TBT median 24 → 58 ms). After the split: median 24 ms, no Signal Field long task.
44. **Test-only hooks (`window.__signalFrames`, `window.__emitSignal`) exist only in a separate test build** (`NEXT_PUBLIC_E2E=1`, `distDir .next-e2e`, `pnpm e2e`), so production bundles never contain them and the e2e build never overwrites `.next`.
45. **Dots are anchored to the viewport** (fixed canvas), so content scrolls over a still grid: no parallax, nothing moves on scroll, and no emits on scroll.
46. **Reduced motion:** one static frame (idle at t = 0, no cursor, no ripples). No loop and no bus subscription, re-checked on the media-query change event.
47. **GPU timing is dev-only** (`EXT_disjoint_timer_query_webgl2`, `[signal-field]` console prefix). Headless Chrome's default SwiftShader doesn't expose the extension; measure with `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` (`scripts/probe/gpu.mts`, needs `pnpm dev` on :3000).
48. **Stop e2e dispatches the click.** The docked composer moves while tokens stream, so Playwright's stability wait could outlast the stream (flaked once at 30 s).

## Chat availability (2026-11-25 review)

49. **One availability check, `getChatAvailability()` (`src/agent/availability.ts`), used by both `/chat` and `/api/chat`.** It zod-validates `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RATE_SALT` (≥ 16 chars), optional `CHAT_MODEL`, and parses `CHAT_ENABLED` strictly (`true`/`false`, default `true`; anything else → `misconfigured`). `/api/chat` returns 503 `unavailable` only when this says not enabled. `CHAT_MOCK=1` (tests, e2e, screenshots) needs no external env.
50. **`/chat` is now rendered per request** (`force-dynamic`). · Keeping it static with a build-time read. · A static page reads env at build while the route reads it at runtime; that gap is exactly how the page showed a working input while every POST failed. Per-request rendering makes disagreement impossible. Lighthouse on `/chat` stays at 100 (see PROGRESS).
51. **Rate limiting fails OPEN on runtime Supabase RPC errors** (replaces #21's fail-closed). · Fail closed. · A transient DB blip shouldn't take the agent down for every visitor. The backstop is a per-instance token bucket (capacity 20/hour per IP hash for chat, 5 for intros, refilled linearly) plus a `[chat]` warning at most once a minute. A failed budget check also fails open, bounded by the same bucket. Risk accepted: during a long DB outage, global spend is bounded only per instance and per visitor. Missing configuration is not a runtime error: it never gets past the availability check.
52. **Anthropic API errors map to `upstream`, not `unavailable`,** so `unavailable` always means "switched off or not configured".
53. **Every error reply carries the book-a-call card.** `rate_limited`/`budget` → "That's a lot of questions…", `unavailable` → the kill-switch line, anything else → the generic line with the email.
54. **Amber focus rings only for keyboard focus, enforced with an input-modality attribute.** · Pure `:focus-visible` (+ `:has()` on the composer). · Browsers match `:focus-visible` on text fields even on a mouse click, which is what drew the amber box on click. A ~200-byte inline script in `<head>` sets `html[data-input]` to `pointer` on pointerdown and `keyboard` on Tab. Text fields lose the ring under `pointer`; the composer gets its amber ring on the box via `:has(textarea:focus-visible)` only under keyboard; mouse focus changes the border to `color-mix(graphite 45%, hairline)`. The attribute defaults to `keyboard`, so keyboard users without JS keep the ring. Buttons and links keep plain `:focus-visible` (browsers already skip it on click). Replaces #30.

## Signal Field tuning, review round 2 (2026-11-25)

55. **Constants, before → after:** aMin 0.16 → **0.16** (the review assumed 0.10; it was already raised in #39 and now reads clearly at 1440 and 1920, not busy, so no step-down) · rBase 0.9 → **1.0** · idle amplitude 0.06 → **0.09**. **Column mask stays 0.25, not 0.35:** at 0.35 the Playwright guard measured 4.13:1 for `--graphite` over the brightest dot pixel at a ripple peak (#39). At 0.25 with the new radius and idle values the guard still passes, and column idle alpha is ≤ (0.16 + 0.46 × 0.09) × 0.25 = 0.050 (≤ 0.06).
56. **Two emitter classes with per-emitter τ** (passed to the shader as `vec4 uE[N] = (x, y, amp, τ)`): ambient (status line, τ 0.9 s, amp 0.35) and interactive (pointer, click, chat send, stream chunks, tool cards; τ 1.6 s). **An emitter is active while A·e^(−Δt/τ) > 0.02**, replacing the fixed 5τ window. An ambient ripple goes quiet after 0.9 × ln(0.35 / 0.02) ≈ 2.58 s, inside the 3.2 s status cycle, so the home page drops to idle for ~0.6 s between lines.
57. **Render modes:** `full` (interactive ripple active, pointer moved < 2 s ago, or the cursor glow still fading) at the display rate (30 on coarse pointers) · `ambient` (only ambient ripples) at 30fps · `idle` at 15fps · `static` under reduced motion. Test builds expose `window.__signalMode`. Before this, the status line kept an emitter "active" (8 s window > 3.2 s cycle), so the home page never left full rate.
58. **Backing store = CSS size × min(DPR, 1.5)** (`SF.maxScale`). Measured at 1920×1080, DPR 2 (Chrome/ANGLE Metal, Apple M2, /lifts, 60 samples per run): scale 2.0 busy 0.75–0.89 ms, rest 0.90–1.10 ms · scale 1.5 busy 0.54–0.75, rest 0.53–0.61 · scale 1.0 busy 0.68–0.98, rest 0.34–0.40 (busy at 1.0 reads high because the GPU clocks down at light load). At 400% (`scripts/probe/crisp.mts`, cursor glow on the patch), 1.0 shows a visibly blurred halo; 1.5 is within a hair of 2.0. At rest, peak dot brightness is 27.0 / 23.0 / 22.1 (2.0 / 1.5 / 1.0). Not visible at 100% on a Retina display. 1.5 is the lowest scale without visible softening. Radii and the 0.75 px AA width are in CSS px (scaled by the backing scale in the shader), so dots keep their size at any scale. Dev and test builds accept `?sfscale=` for comparisons.
59. **Only active emitters reach the shader:** the CPU packs emitters whose A·e^(−Δt/τ) > 0.02 to the front and passes the count `uN`; the ripple loop breaks at `uN`. Idle frames run zero ripple iterations.
60. **Mid-stream list markers** (`- ` with no text yet) are skipped by the chat markdown parser, so a list doesn't flash an empty bullet while streaming (found in the 375px review shot).
