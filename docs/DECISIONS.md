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

## Garage Gym (2026-11-16)

### Routes
- **The Training Log moved to `/log/` as one file move.** Same components, ids and CSS. The top bar's flight links and the 0 to 8 shortcuts point at `/log/#id` from every other page. The monogram and the "back to the portfolio" links go to `/`.
- **`/` has no top bar.** The text block is the header. The 0 to 8, L and G shortcuts still work there because the layout-level runtime is shared.
- **Lights follow the system colour scheme on a first visit, site-wide.** The boot script is shared, so `/log/`, `/gym/` and `/notes/` now also open dark for a visitor whose system is dark and who never chose. A stored choice always wins. `data-lights="off"` (illustration palette) and `data-theme="dark"` (interface tokens) are always set together.

### Pipeline
- **Tracer: Potrace, not VTracer.** Compared on A02 with the same masks (`scripts/illustrations/compare.ts`):

  | Tracer | Nodes | Bytes after SVGO | Area-weighted IoU against the masks | Worst layer |
  | --- | --- | --- | --- | --- |
  | Potrace (npm `potrace` 2.1.8) | 1021 | 23,185 | 0.9929 | 0.9596 |
  | VTracer (`@neplex/vectorizer` 0.1.0, spline mode) | 1825 | 30,189 | 0.9783 | 0.9118 |

  Potrace has 44% fewer nodes and is closer to the source. On a01b the result is the same shape: 2238 against 3419 nodes. VTracer stays as a devDependency for the comparison script only. Potrace is GPL-2.0: it is a build tool here, its output is not a derived work, nothing of it ships.
- **Snap runs on pixels before the geometry is traced,** not on traced paths afterwards as the prompt orders it (d then e). Every pixel gets its nearest palette class by CIEDE2000, then each class is traced. "Merge adjacent paths that land on the same colour" then happens for real: one region, one path, no seams between a colour and its shade tone. Snapping traced paths would only allow concatenating path data.
- **Stacking:** the first path of every part is its whole silhouette in iron. Fills are stacked on it from the largest to the smallest, and each fill grows 3 px (at 3x) under the fills above it. Iron pixels are never traced on their own: the outline is what shows of the silhouette between the fills.
- **Parts are enlarged 3x (cubic) before classification,** so Potrace fits curves on more than a few pixels. Sheets are only 1376 x 768. Path data is scaled back to source pixels.
- **Key distance is CIELAB with lightness at half weight,** soft band 28 to 60. Gemini drew a darker magenta ground shadow under the poses: it is still background, and it keys out cleanly this way.
- **Rim colours are dissolved.** A palette class that has no solid core in a part (under 60 px, or a thousandth of the part, after a 2 px erosion) is a rim of blended edge pixels. Its pixels go to the neighbouring classes.
- **A part map may ignore a component, with a reason,** and several components may share one name. A02 has three surplus face-on plates (duplicates of red, blue and chalk): ignored, all 17 spec parts are present. The map also states the component count, so a regenerated sheet that splits differently fails.
- **A sheet without a map is pending, not an error.** A03 to A12 arrived in `raw/` during this run and are out of its scope.
- **The raw files are JPEG data with a `.png` name.** The pipeline decodes by content.
- **No WebP fallback was needed.** The code path exists (over 40 kB gzipped per object) and has never fired.
- **Generated output is three things per object:** `generated/aNN/*.svg` (one optimised file per part, classes only), `generated/aNN.ts` (the same paths as a module, so server components inline them) and `manifest.ts`. The manifest also records each part's origin on the sheet.

### Character
- **A01 is built from whole poses (a01b), not a puppet.** The puppet sheet has merged limbs (14 components, 16 parts in the spec). Per the spec's own fallback: idle, wave and chalk poses are swapped with no tween. Poses share one anchor, the point between the feet.
- **Kept from the puppet spec:** breathing (scaleY 1 to 1.015 over 4 s, on the whole idle pose, anchored at the feet), the entry (wave, then chalk with two loose puffs fading), wave on hover.
- **Dropped, because the parts do not exist:** blink (needs a second head), head tracking toward the pointer (needs a head), three separate forearm waves (the wave pose is held for 900 ms instead).

### Scene
- **Eleven links and one button.** The lamp is the lights control, not a destination, so it is a `<button>`. It is hidden without JS. The plain list therefore has eleven links.
- **Targets the prompt did not assign:** the character goes to `/log/#platform` (intro), the bike to `/log/#actual-log` (flight 07 is where the bike line belongs once it is written), the bot to `/notes/`. See OPEN_QUESTIONS.
- **Stations carry `w` and `h`** besides x, y and scale: placeholders need a footprint. For traced objects the footprint is computed from the composed parts.
- **Six plates fit on the sleeve at 0.7 scale with overlap.** At sheet scale they are 36 px wide and the sleeve is 100 px.
- **Plates wait off the bar (opacity 0) until the runtime starts the entry,** otherwise they would show seated and then jump out. Only with JS and with motion allowed. A CSS fallback shows them after 3 s if the runtime never arrives.
- **Touch:** the character's wave is 900 ms, so the first tap plays it and the second follows the link. The rack's rattle is 240 ms, so a tap navigates at once.
- **Below the fold objects are not lazy chunks.** Both traced objects together are 19 kB gzipped and one is above the fold at desktop sizes. Revisit when all twelve are traced.
- **Lights off is a dimmed room, not an inverted one.** Every `--i-*` colour is darkened, the wall is `#30343C`. Interface text keeps the existing dark tokens. Label contrast is checked in e2e against wall, band, platform and page in both states.

### Accessibility over design
- **Mono labels are 12px, not 11px, in the stacked layout (below 1024px).** With 11px labels Lighthouse measured 23% legible text on a phone.
