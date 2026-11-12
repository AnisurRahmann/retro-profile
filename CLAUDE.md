# arshakil.com: The Drawing Set

Personal portfolio for Anisur Rahman (Shakil). One static page drawn as an engineering drawing set.
Resume work from `docs/PROGRESS.md`. Scope is in `docs/PLAN.md`, reasoning in `docs/DECISIONS.md`.

## Commands

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # must all pass before any commit
pnpm e2e            # Playwright against `next start` on :3100 (needs a build)
pnpm shots          # screenshots into .shots/ (360, 768, 1440 x PAPER/BLUEPRINT x redlines ON/OFF)
pnpm format
```

Next.js here is 16.4 and differs from older versions. Read `node_modules/next/dist/docs/` before using an API you are not sure of (see `AGENTS.md`).

## Hard rules

- **All copy and data live in `src/content.ts`**, validated by `src/content.schema.ts`. Components never hardcode copy;
  interface labels are in the `ui` export. `tests/copy.test.ts` enforces this.
- Do not invent metrics, clients, dates or links. A missing link means no `link` field and an entry in `docs/OPEN_QUESTIONS.md`.
- No content about relocation, visas, job hunting, salary or "open to work".
- Fully static. No database, auth, API routes (except the OG image), analytics, env vars or LLM calls.
- Dependencies: next, react, tailwind, clsx, zod, vitest, @playwright/test and their tooling. No UI kits, icon packs,
  animation, chart or graph libraries. Visuals are hand-written SVG or canvas. Log any addition in DECISIONS.
- Server Components by default. `"use client"` only on islands: `HeroCanvas`, `SystemMap`, `Register`, `Drawer`,
  `Toggles`, `Runtime`, `CountUp`, `ProjectRef`, `islands`.
- Client islands must not import zod or `content.schema.ts` values (types only). Ids come from `src/content.ids.ts`.
  Client islands take copy as props. First-load JS budget is 150 kB gzipped and is tested in e2e.
- Do not deploy or push without being asked.

## Design rules (short form)

- An engineering drawing set: drafting paper, ruled lines, title blocks, stamps, redline markup. Not a terminal theme,
  not glass, not gradients, not bento cards.
- Line language carries meaning: **solid** = shipped, **hatched** = in build, **solid + dashed inner** = built not deployed,
  **dashed** = spec'd, **dotted** = idea, **red** = goals and next revisions.
- Palette is closed: `--paper --paper-2 --ink --graphite --rule --redline` (plus `--redline-text` for AA contrast). Two themes: PAPER, BLUEPRINT.
- Square corners (radius 2px max), no shadows. Depth is line weight only: 1px hairline, 2px object, 3px section cut.
- Type: Archivo width 125 uppercase for headings, Plex Mono 11px uppercase 0.08em for labels, Plex Sans 17px body (62ch), Caveat for redline notes only.
- Every section is a sheet with a title block bottom right. Fixed frame with zone letters and numbers.
- Motion is drafting only: lines draw, stamps press, numbers count, redlines get marked. Every animation has a
  static state under `prefers-reduced-motion` and without JS.
- Anything a goal touches carries class `redline` so the global switch hides it.
- If a design rule and an accessibility rule conflict, accessibility wins and it is logged in DECISIONS.

## Where things are

- `src/content.ts`, `src/content.schema.ts`, `src/content.ids.ts`: content, schemas, id lists
- `src/app/`: layout (fonts, no-flash script), page, `globals.css` (tokens and all component CSS), OG image, sitemap, robots, icon
- `src/components/sheets.tsx`: the eight sheets. `visuals.tsx`: trace, dimensions, revision table, diagrams. `primitives.tsx`: Sheet, TitleBlock, RedNote, RedCircle
- `src/lib/`: `mapLayout.ts` (pure map layout), `trace.ts` (hero signal), `handdrawn.ts` (seeded redline paths), `prefs.ts`, `store.ts`, `validate.ts`, `derive.ts`
- `tests/` vitest, `e2e/` Playwright, `scripts/shots.ts`

## Changing content

- Add a project: append to `projects` in `src/content.ts` with the next `P-nn` id, a `bus` and a `status`.
  It appears on the map, in the register and in the counters. If it has a `redline`, give it a `redlineTag` of 18 characters or fewer.
  `connectsTo` must be mirrored on the other project. Run `pnpm test`.
- Move a project between statuses: change `status`. Outline, stamp and counters follow.
- A goal is an entry in `goals.items` with a horizon and the project ids it attaches to.
