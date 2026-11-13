# Decisions

## Replaced or removed (all still in git history on `main`)
- Create React App (`react-scripts`, `src/App.tsx`, `src/components/**`, `src/styles/**`, `src/index.*`, `public/index.html`, `package-lock.json`, `postcss.config.js`) replaced by Next.js 16 App Router with static export.
- `scripts/parse-content.js` and `scripts/inject-route-meta.js` removed. Next prerenders every route, so there is nothing to inject.
- `src/data/gym.ts` moved to `src/gym.ts`. `src/data/portfolio.ts` replaced by `src/content.ts`.
- `content/*.md` (about, companies, contact, hero, now, outro, skills, socials, stats) and `content/projects/*` removed: their role is taken by `src/content.ts`. `content/blogs/*` kept and rendered at `/notes`.
- `public/favicon.*`, `icon-192/512.png`, `apple-touch-icon.png`, `manifest.json`, `og-home.png`, `og-gym.png`, social SVG icons, `robots.txt` removed. Replaced by `src/app/icon.svg`, `/og.png`, `robots.ts`, `sitemap.ts`.
- Kept untouched: `public/resume.pdf`, `public/images/gym/*.jpg`, `design-system/`, `design-system.md`, `assets/`, `PRODUCT.md`, `CHANGELOG.md` (old design system and history, not used by the new app).

## Stack
- Next 16.4.6, React 19, Tailwind 4, zod 4, TypeScript 5.9. TypeScript 7 was installed by default and rolled back: eslint's TypeScript parser does not support it yet.
- `output: "export"` with `trailingSlash: true`: plain files in `out/`, portable to any static host. `/gym` and `/gym#friday` keep working.
- Extra dependency: `marked`, the allowed markdown renderer, used only for the two legal pages. The seven posts use a custom chapter format, parsed by hand in `src/lib/notes.ts`.
- eslint and its Next config are dev tooling needed for `pnpm lint`. Lighthouse runs through `npx`, it is not a dependency.
- Two Next lint rules are off (`no-html-link-for-pages`, `no-location-assign-relative-destination`): links are plain anchors on purpose, so every page is a full document load and the head script always runs.

## Deviations from the spec, with reasons
- **Steel in LIGHTS ON is `#5F636A`, not `#6A6E75`.** The spec value is 4.1:1 on chalk-2 panels and fails AA for 11px labels. Accessibility wins.
- **Big Shoulders Display** no longer exists as its own Google family. It is "Big Shoulders" with an optical-size axis. The site self-hosts the latin instance pinned at opsz 72, wght 900 (`src/assets/`, SIL OFL), which is the Display cut. Only weight 900 is used.
- **Hero barbell and today's-session chip are CSS, not client components.** The plates slide and the bar bends through CSS keyframes on a registered `--sag` property. The weekday is computed in Asia/Dhaka by a small script in `<head>` and written to `<html data-today>`, CSS then shows the right chip. Result: correct from the first frame, no hydration mismatch, no layout shift. The server HTML still shows the full week strip.
- **Your Call is native radios plus CSS `:has()`,** not a React component. It works before hydration, arrow keys work for free, and with JS off every outcome is visible. JS only announces the reveal to screen readers.
- **Load the Bar is lazy through `import()` inside a client shell,** not `next/dynamic`. `next/dynamic` cannot keep the server-rendered rack on screen while the chunk loads. The shell does, so there is no flash and no-JS users keep a working rack (plates link to their register row).
- **One client island for page behaviour** (`Runtime.tsx`: theme toggle, shortcuts, lights, count-up, print prep) instead of one per feature. The register is the only other hydrated component besides the game.
- **Option order in Your Call is shuffled per scenario** (`order` in content). In the source data the real call is always option c, which would make the game a pattern after one round. Data and tests still mark exactly one option as actual.
- **Hero plates are iron, all one size.** Plate colour means category and plate size means status, so the six PR plates carry neither.
- **Tier plates are neutral outlines** for the same reason.
- **Referee lights sit in an iron light box** in both themes. White lights on a chalk page would be invisible.
- **Amber `#F59E0B`** is used only for the pulsing "in build" light. It is a status colour, not a plate colour.
- **Top bar links use the plain labels** (Metrics, Work, Projects) with flight numbers. Section headers carry both the metaphor and the plain label.
- **Phones: the flight links collapse into a FLIGHTS menu,** and the call button reads "BOOK A CALL".
- **Single-key shortcuts (0 to 8, L, G)** are ignored while focus is in a form field or a modifier is held. WCAG 2.1.4 would also want a way to turn them off, see OPEN_QUESTIONS.
- **PR cards show only numbers that were given.** No delta is computed. Where no previous value exists (PR 03, 05, 06) the PREVIOUS row is left out.
- **Goal "current" values are derived:** from the linked project's status, or counted from data. One is stated by hand, see OPEN_QUESTIONS.
- **Gym wording follows the spec, data follows the repo file.** Sets, reps, order and photo mapping match the old `src/data/gym.ts` exactly. Notes and rules use the spec wording (no dashes or arrows). No factual difference was found between the two.
- **Gym photos:** originals untouched, the page uses grayscale WebP derivatives in `public/images/gym/opt/`. Day headers are always dark with light text so contrast holds in both themes.
- **Canonical host is `https://www.arshakil.com`** because the live apex redirects there.
- **`/fb-privacy` and `/fb-data-deletion` were ported** from the local `fb-legal-pages` branch (content unchanged). They were not on `main`, but Meta app review depends on them and the rebuild would otherwise have dropped them.
