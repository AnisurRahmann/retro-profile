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
