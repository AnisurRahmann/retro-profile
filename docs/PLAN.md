# Plan: The Training Log (arshakil.com)

Spec: the build prompt "Portfolio Build Prompt v2: The Training Log". Branch: `redesign/training-log`.

## Phase 0. Foundation
- [x] 0.1 Branch `redesign/training-log`, remove the CRA app. Done when: no CRA file is left and `main` is untouched.
- [x] 0.2 Next.js 16 App Router, TypeScript strict, Tailwind 4, pnpm, `src/` layout, static export. Done when: `pnpm build` writes `out/`.
- [x] 0.3 Tooling: eslint, vitest, Playwright, static server, screenshot and Lighthouse scripts. Done when: every `pnpm` script runs.
- [x] 0.4 Design tokens, fonts, theme toggle with no flash. Done when: theme is applied in `<head>` before paint (e2e).

## Phase 1. Content
- [x] 1.1 `src/schema.ts` zod schemas. Done when: bad content fails the build.
- [x] 1.2 `src/content.ts`, `src/gym.ts`. Done when: gym data matches the old `src/data/gym.ts`.
- [x] 1.3 Unit tests: unique ids, `connectsTo` resolves, valid bus and status, derived counters, one actual option per scenario. Done when: `pnpm test` is green.

## Phase 2. Static site
- [x] 2.1 Flights 00 to 08 server-rendered with real content. Done when: with JS disabled every project, metric, block, goal and gym day is in the HTML (e2e).
- [x] 2.2 `/gym` with seven day panels, photos, rules, deep links. Done when: `/gym#wednesday` lands on Wednesday (e2e).
- [x] 2.3 `/notes` and `/notes/[slug]` from `content/blogs`. Done when: seven posts render (e2e).
- [x] 2.4 `/fb-privacy`, `/fb-data-deletion` carried over. Done when: both render without JS (e2e).

## Phase 3. Signature visuals and games
- [x] 3.1 Hero barbell with whip, PR readout, today chip. Done when: reduced motion shows the loaded bar at rest (e2e).
- [x] 3.2 Lights that switch on in view, count-up. Done when: both end in the final state (e2e).
- [x] 3.3 Load the Bar: drag, click, keyboard, persistence, GOOD LIFT, strip. Done when: mouse, touch and keyboard e2e pass.
- [x] 3.4 Register: sort and filter. Done when: e2e passes.
- [x] 3.5 Your Call: radios, reveal, reveal all. Done when: keyboard e2e passes and no-JS shows all five.

## Phase 4. Meta
- [x] 4.1 Metadata, Open Graph, Twitter, JSON-LD Person. Done when: e2e reads them.
- [x] 4.2 `/og.png` via next/og, sitemap, robots, favicon. Done when: all return 200 (e2e).
- [x] 4.3 Print stylesheet. Done when: print shows the register, not the rack.

## Phase 5. Verification and polish
- [x] 5.1 Two rounds of screenshot review at 360, 768, 1440 in both themes. Done when: defects are logged and fixed in PROGRESS.md.
- [x] 5.2 Lighthouse on the production build. Done when: scores are recorded.
- [x] 5.3 Deploy steps written. Done when: PROGRESS.md has them.

## Follow-ups (not started, prompts are in the build prompt)
- [ ] F3 Load the Bar feel: roving focus, Backspace to unload, inside-out snap.
- [ ] F4 Your Call polish: remembered answers, combined result row.
- [ ] F5 Detail pages for five case studies and four projects.
- [ ] F6 Deploy.
