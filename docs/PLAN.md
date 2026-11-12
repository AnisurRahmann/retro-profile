# PLAN: arshakil.com, "The Drawing Set"

Source of truth for scope is the original build prompt (sections 1 to 9). This file expands its
phases into tasks with a definition of done (DoD). Status lives in `docs/PROGRESS.md`.

## Phase 0: Foundation

- [x] 0.1 Branch `redesign/drawing-set` off `main`; remove the CRA app the new app replaces. DoD: `main` untouched, removals listed in DECISIONS.
- [x] 0.2 Scaffold Next.js (App Router, TS strict, Tailwind 4, pnpm, `src/`). DoD: `pnpm build` green.
- [x] 0.3 Tooling: eslint, prettier, strict tsconfig, vitest, Playwright. DoD: `pnpm typecheck && pnpm lint` green.
- [x] 0.4 Docs: PLAN, PROGRESS, DECISIONS, OPEN_QUESTIONS, CLAUDE.md. DoD: a fresh session can resume from PROGRESS alone.
- [x] 0.5 Design tokens as CSS variables (six-colour palette, both themes), grid texture. DoD: no colour literal outside `:root` blocks, `palette.ts` and the favicon.
- [x] 0.6 Fonts via `next/font/google`: Archivo (wdth axis), IBM Plex Sans, IBM Plex Mono, Caveat. DoD: CLS 0 in Lighthouse.
- [x] 0.7 Sheet frame: fixed top bar, zone strips (1 to 8, A to H), sheet component, title block. DoD: every sheet has a title block bottom right.
- [x] 0.8 Theme toggle with no flash. DoD: inline head script sets attributes before paint; e2e reload test passes.

## Phase 1: Content

- [x] 1.1 `src/content.schema.ts` zod schemas for all exports. DoD: types inferred from schemas.
- [x] 1.2 `src/content.ts` with everything from section 6, plus all interface copy (`ui`). DoD: no `[[placeholder]]` reaches the page.
- [x] 1.3 Build-time validation (`src/lib/validate.ts`). DoD: invalid content fails `next build`.
- [x] 1.4 Vitest content tests: unique ids, connectsTo resolves and mirrors, valid bus and status, counters derived. DoD: `pnpm test` green.

## Phase 2: Static sheets

- [x] 2.1 Sheet 00 Cover. 2.2 Sheet 01 Impact. 2.3 Sheet 02 Production work. 2.4 Sheet 03 System map.
- [x] 2.5 Sheet 04 Register. 2.6 Sheet 05 How I build. 2.7 Sheet 06 Next revisions. 2.8 Sheet 07 Contact.
- DoD: with JavaScript disabled the page is a complete, finished document.
- [x] 2.9 Verification loop.

## Phase 3: Signature visuals (each with a reduced-motion fallback)

- [x] 3.A Hero signal trace: canvas over a server-rendered SVG. DoD: no canvas under reduced motion, under 4 ms per frame.
- [x] 3.B System map: pure layout function, status outlines, orthogonal wires, legend, mobile bus list. DoD: layout unit tests green.
- [x] 3.C Redline layer: global switch, hand-drawn circles, leader arrows, margin notes. DoD: OFF removes every annotation from layout and the accessibility tree.
- [x] 3.D Dimension callouts with count-up. DoD: final value in server HTML.
- [x] 3.E Revision table timeline with expanding rows. DoD: works without JS (`<details>`).
- [x] 3.9 Verification loop.

## Phase 4: Interaction

- [x] 4.1 Cross-highlighting between map, register and goal chips.
- [x] 4.2 Register sort, bus and status filters, expanding rows.
- [x] 4.3 Keyboard: 0 to 7, R, B, arrow keys in the map. Legend in the footer.
- [x] 4.4 Detail drawer: focus trap, Escape, focus return.
- [x] 4.5 Sheet border draws clockwise once per sheet.
- [x] 4.6 Verification loop.

## Phase 5: Meta

- [x] 5.1 Metadata API, canonical, OG and Twitter tags. 5.2 JSON-LD Person. 5.3 OG image via `next/og`.
- [x] 5.4 sitemap, robots. 5.5 SVG favicon. 5.6 Print stylesheet.

## Phase 6: Verification and polish

- [x] 6.1 Full loop: typecheck, lint, test, build, shots, e2e, Lighthouse.
- [x] 6.2 Visual review round 1 and fixes. 6.3 Visual review round 2 and fixes.
- [x] 6.4 Final scores, open questions and deploy steps in PROGRESS.

## Not in this build (follow-up prompts)

Independent design review by a fresh subagent, pan and zoom on the map, `/work/[slug]` and
`/projects/[id]` detail routes, `pnpm content:check` with `statusSince`, deploy.
