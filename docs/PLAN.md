# Plan

Definition of done for every phase: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green, docs updated, one conventional commit.

- [x] **0 Foundation** — Next 16 + TS strict + Tailwind 4 + eslint/prettier, tokens as CSS vars + Tailwind theme, Geist fonts, header/footer/768px column. DoD: blank shell builds.
- [x] **1 Content** — `src/content.ts` + zod schemas with everything in brief §7; vitest: ids unique, hrefs valid, no `[[` in rendered props. DoD: tests green.
- [x] **2 Static pages** — `/`, `/work/[slug]`, `/lifts`, `/privacy` with real content; looks finished without JS. DoD: verification loop (shots reviewed).
- [x] **3 Motion** — waveform, rotating status line, show-more, hover states; reduced-motion path for each. DoD: verification loop + e2e for show-more and reduced motion.
- [x] **4 Agent backend** — knowledge build, `/api/chat` NDJSON stream, tools, guardrails, rate limit + budget (Supabase RPC), logging, `/api/intro` + Resend, migrations incl. 90-day retention. DoD: unit tests for encoder/parser, tools, validation.
- [x] **5 Agent UI** — `/chat` empty + conversation states, tool cards, intro form, stop, errors, kill switch. DoD: verification loop with mocked model.
- [x] **6 Evals** — model adapter (anthropic + mock), `evals/cases.yaml` (≥30), `pnpm eval:live` with 2 layers + report; `pnpm test` runs the harness on the mock. DoD: mock suite passes.
- [x] **7 Meta + polish** — metadata, OG images (site + chat), JSON-LD Person, sitemap, robots, SVG favicon, `[[` build-output grep test, verification loop twice, Lighthouse recorded.
