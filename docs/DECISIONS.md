# DECISIONS

Each entry: the decision, the alternative rejected, and why.

## Repo

1. **Replaced the Create React App "reels" portfolio in place, on branch `redesign/drawing-set`.**
   Removed from the branch (all still on `main`): `src/` (reels, blogs, gym page), `public/` (favicons,
   OG PNGs, `resume.pdf`, gym images), `scripts/` (`parse-content.js`, `inject-route-meta.js`),
   `package.json`, `package-lock.json`, `tsconfig.json`, `postcss.config.js`, the CRA `README.md`,
   `.DS_Store`. Also deleted the untracked npm `node_modules/` (regenerable; restore on `main` with `npm ci`).
   Kept untouched: `assets/`, `content/`, `design-system/`, `design-system.md`, `PRODUCT.md`, `CHANGELOG.md`,
   `docs/redesign/`, `build/` (old CRA output, gitignored).
   Rejected: a sibling folder or git worktree. The prompt says to build in the existing repo on this branch.
2. **Old routes are not carried over**: `/gym`, `/hire`, `/reel`, `/fb-privacy`, `/fb-data-deletion`, blogs.
   The prompt defines one static page. See OPEN_QUESTIONS 6: the two `fb-*` pages may be required by a Facebook app.

## Stack

3. **`cacheComponents` and `partialPrefetching` turned off** (create-next-app 16.4 turns them on).
   Rejected: keeping them. The site is one fully static page with no data fetching, and the title blocks
   stamp the build date with `new Date()` at prerender, which Cache Components treats as uncached time.
4. **Tailwind through `@tailwindcss/turbopack`**, as the 16.4 template ships it. Rejected: `@tailwindcss/postcss`.
   Tailwind's default colours, radii and shadows are reset in `@theme` so the closed palette is enforced.
5. **Most styling is hand-written CSS in `globals.css`**, with Tailwind for preflight and utilities such as `sr-only`.
   Rejected: utility classes everywhere. The drawing vocabulary (line weights, stamps, redlines) reads better as named rules.
6. **Dev dependencies beyond the allowed list**, all tooling the stack requires: `typescript`, `eslint`,
   `eslint-config-next`, `prettier`, `@tailwindcss/turbopack`, `@types/*`. No runtime dependency outside the list.
   Lighthouse runs through `pnpm dlx` and is not installed. `scripts/shots.ts` runs on Node's type stripping, so no `tsx`.
7. **TypeScript 5.9 and ESLint 9**, the versions the Next 16.4.6 template pins. Rejected: TS 7 / ESLint 10 (newer, not what `eslint-config-next` targets).
8. **Two TTF files committed in `src/assets/`** (Archivo Expanded 800, IBM Plex Mono 500, both OFL) for the OG image.
   `next/og` cannot read `next/font` output or variable fonts. Rejected: fetching them at build time.

## Content

9. **Zod never reaches the client.** Components import types only. Id lists live in `src/content.ids.ts`.
   Found during Phase 6: a value import pulled 31.6 kB gzipped of zod into the client and broke the 150 kB budget.
10. **All interface copy is in `content.ts` under `ui`**, and client islands receive copy as props.
    `tests/copy.test.ts` fails on any three-word string literal or JSX text in `src/components` or `src/app`.
11. **Fields added beyond the prompt's project shape**: `redlineTag` (max 18 characters, a verbatim fragment of
    the redline, sized to one map slot), `install`, `version`. Goals carry `projectIds` so each attaches to a project.
12. **Case study "problem" lines are restatements of the given before-state**, not new facts
    (for example "Median support response sat at 3.5 minutes"). Review them; see OPEN_QUESTIONS 4.
13. **Metric M-01 shows "21×"**, computed from the stated 3.5 min to 10 s, and is labelled as computed.
    Metrics 5 and 6 have no stated before value, so their ends read "Baseline" and the remaining share.
14. **Sheet 02 is ink only.** No goal in section 6 attaches to past employment, so no redline was invented for it.
15. **Principle 6 has a title and no body**, because the prompt gives one sentence. A body line I had drafted was removed as invented copy.

## Design

16. **Fifth status style.** The legend defines four line styles but there are five statuses.
    BUILT / NOT DEPLOYED is a solid outline with a dashed inner line: built (solid) with deployment still planned (dashed).
    The counters show five statuses plus a total, not the four listed in the prompt, so the two built projects are counted honestly.
17. **Accessibility over palette: `--redline-text`.** `#E0452B` on `#EFEAE0` is 3.4:1, below AA for small text.
    Red text uses `#AD2D18` (paper) and `#FF7C5E` (blueprint). Strokes, circles and borders keep `--redline`.
18. **Accessibility over type scale at 360px.** Sheet headings drop to width 100 and `min(2.5rem, 10.4vw)` below 480px.
    At width 125 and 2.5rem, single words such as PRODUCTION overflow a 360px sheet.
19. **Cross-highlighting is done in the DOM, not React state** (`highlightProject` in `src/lib/store.ts`).
    Rejected: shared state, which would re-render the map and the register on every hover.
20. **Redline OFF uses `display: none`** on `.redline`, which removes annotations from layout and from the
    accessibility tree. Rejected: unmounting in React, which needs every annotation to be a client component.
21. **Sheet 06 with redlines OFF** shows an ink notice and a button to turn redlines on, and its frame falls back
    to the rule colour. The sheet is all goals, so "present state only" means it is blank.
22. **The map is one pure function** (`src/lib/mapLayout.ts`) with unit tests. Wires run in lanes under the node
    row and in a gutter channel left of the rails, so a wire cannot cross a node or a rail by construction.
23. **Hero trace on screens under 1000px**: blocks sit in a row above the wire with dashed leaders down to it.
    Five labelled blocks do not fit on the wire at 360px without hiding the signal.
24. **Hero canvas over a server-rendered SVG.** The SVG is the no-JS and reduced-motion fallback; the canvas
    is `ssr: false` and is never mounted under `prefers-reduced-motion`.
25. **`next/dynamic` is called from a client file (`islands.tsx`).** Next 16 does not code-split a client
    component that a Server Component imports dynamically. The map keeps SSR, so it is in the static HTML.
26. **Revision table rows are `<details>`**, not a `<table>` with script. They expand without JavaScript.
27. **Sheet border animation hides sheet content until the sheet is in view, only when JS is running**
    (`html.js`). The cover is exempt so LCP is not delayed.
28. **Print**: A3 landscape, paper palette forced, fixed chrome hidden, redlines forced on, one sheet per page start.
