# Garage Gym: coding agent prompts

Two prompts. Run Prompt 1 once `a00-anchor-room.png`, `a01-character-sheet.png` (or `a01b-character-poses.png`) and `a02-rack-sheet.png` are in `assets/illustrations/raw/`. Run Prompt 2 after the remaining sheets are there.

---

## Prompt 1: pipeline, new home page, character and rack

```
You are rebuilding the home page of arshakil.com as "The Garage Gym": one illustrated room where every object is a section entry point. Illustrations are Gemini-generated raster parts sheets. You build the asset pipeline, the scene, and the first two animated objects.

READ FIRST, in this order
1. CLAUDE.md
2. docs/PROGRESS.md, docs/DECISIONS.md
3. docs/GARAGE_GYM_ILLUSTRATIONS.md (style lock, asset list, section 5 motion table, section 6 build rules). This file is the spec for art and motion. Where it conflicts with the design rules in CLAUDE.md, it wins.
4. src/content.ts, src/schema.ts, src/lib/derive.ts, src/app/page.tsx, src/app/globals.css

BRANCH
Create `redesign/garage-gym` from `redesign/training-log`. Do not touch `main`. Do not deploy, do not change Vercel or DNS. Commit in small steps, never a red gate.

SCOPE OF THIS RUN
In: asset pipeline, new `/` route, scene layout, character (A01) and rack (A02) fully animated, placeholders for the ten objects whose art does not exist yet, lights toggle wired to a placeholder control, tests, docs.
Out: restyling /gym, /notes, legal pages, and any object from A03 to A12.

STEP 1. Preserve the current site
- Move the current home page wholesale to `/log/` (same components, same section ids, same CSS). Nothing on it changes visually.
- `/gym/`, `/notes/`, `/fb-privacy`, `/fb-data-deletion` stay exactly as they are.
- Update sitemap, internal links, e2e tests and the skip links so the old home tests now target `/log/`.
- Gate must be green before step 2.

STEP 2. Asset pipeline (`scripts/illustrations/`)
Input: `assets/illustrations/raw/aNN-*.png`, flat parts on #FF00FF. Output: optimised SVG parts plus a typed manifest in `src/illustrations/generated/`. Outputs are committed, so `pnpm build` never runs the pipeline. Expose it as `pnpm illustrations` and `pnpm illustrations <id>`.

Stages, each a pure function with a unit test on a small fixture:
a. Key. Classify background by distance to #FF00FF in CIELAB, not RGB equality: Gemini output has compression noise and anti-aliased edges. Build an alpha matte with a soft threshold band, then despill magenta from semi-transparent edge pixels by pulling them toward the outline colour #17181A. Fail loudly if less than 20% or more than 90% of the canvas is background.
b. Split. Connected-component labelling on the binary matte, 8-connectivity. Drop components under 0.05% of canvas area as specks. Sort in reading order (row bands by centroid y, then x). Emit a contact sheet PNG per source with each component's index drawn beside its bounding box, into `.illustrations/contact/`.
c. Name. Each source has a hand-written map `assets/illustrations/parts/aNN.json`: component index to { name, pivot: [x, y] normalised to the part's bbox, z }. View the contact sheet yourself and write this map. If the component count does not match the parts listed for that asset in docs/GARAGE_GYM_ILLUSTRATIONS.md, stop and report which parts are missing or merged. Do not guess.
d. Trace. Vectorise each part in colour mode with stacked layers so the outline is one closed path under the fills. Evaluate two tracers on A02 and keep the one with fewer nodes at equal visual fidelity: record the comparison in docs/DECISIONS.md.
e. Snap. Map every fill to the nearest palette colour by CIEDE2000 and replace it with a class (`i-chalk`, `i-iron`, `i-grey`, `i-tan`, `i-red`, `i-blue`, `i-yellow`, `i-green`, `i-skin`). Merge adjacent paths that land on the same colour. Any region further than a threshold from every palette colour is reported, not silently snapped.
f. Optimise. SVGO with a fixed config, 1 decimal of precision, ids stripped, viewBox normalised to the part bbox.
g. Manifest. `src/illustrations/generated/manifest.ts`: per asset, per part: name, viewBox, intrinsic size, pivot, z, byte size. Typed, parsed by a zod schema added to src/schema.ts.

Pipeline tools are devDependencies only. Add them to the allowed list in CLAUDE.md under a "build-time only" heading. No new runtime dependency.

Fallback: if tracing a sheet produces visible outline wobble or more than 40 kB gzipped for one object, emit keyed WebP cutouts for that object instead and record it. Theme swap for a WebP object is then a CSS filter, logged as a known compromise.

STEP 3. Scene model
- `src/scene.ts`: zod-parsed placement data. Scene coordinate space 1600 x 900. Each station: id, asset id, x, y, scale, z, target href, label, plain label, section id from `flights` in content.ts. Twelve stations as listed in docs/GARAGE_GYM_ILLUSTRATIONS.md section 5. Composition follows a00-anchor-room.png left to right.
- Targets point into the preserved page: `/log/#pr-board`, `/log/#training-blocks`, `/log/#load-the-bar`, `/log/#training-rules`, `/log/#next-block`, `/log/#no-lift`, `/log/#spot-me`, and `/gym/`, `/notes/`. Labels and plain labels come from `flights` and `ui`. No new copy in components: add strings to `ui`.
- Room backdrop is CSS and inline SVG only (wall, lower band, floor line, platform). No backdrop raster.

STEP 4. Home page (`/`)
Order in the DOM, all server-rendered:
1. Header text block: name, role line, the six metrics as a compact list (value plus `short` from `metrics`), call button to the calendar link, email link. This block is the LCP and must be complete without JS or images.
2. The scene: an element with `role="group"` and an accessible name, containing twelve `<a>` stations. Each station has a visible label in IBM Plex Mono with its plain meaning, and a focus ring that does not rely on colour alone.
3. A plain list of the same twelve links for no-JS, screen readers and print.

Layout:
- At 1024px and up: the 1600 x 900 scene scales with `aspect-ratio` and container query units. Stations are absolutely placed from scene.ts as percentages.
- Below 1024px: no scaled-down room. Stations restack into a single column in section order, each station is a row with its object at a fixed height and its label beside it. Same components, different layout mode from CSS only. No horizontal scroll at 360px, guarded by an e2e test.
- Objects below the fold are separate lazy chunks or lazily inlined SVG. Total illustration SVG for `/` under 250 kB gzipped. First-load JS for `/` under 90 kB gzipped.

Stations without art yet (A03 to A12) render as a dashed iron outline box at the object's footprint with the label inside. They are real links and must look deliberate, not broken.

STEP 5. Animation runtime
One small client module, no library. Components that animate receive plain props and never import content.ts.
- All motion is `transform` and `opacity` on SVG groups with `transform-box: fill-box` and `transform-origin` from the manifest pivot.
- Idle loops are CSS keyframes. Sequenced motion uses the Web Animations API with one timeline per station, cancellable.
- Entry sequences fire once per page load via IntersectionObserver at 40% visibility. Nothing replays on scroll.
- Hover, focus-visible and tap trigger the same interaction. On touch, first tap plays the interaction and second tap follows the link only if the interaction is longer than 300 ms: otherwise navigate immediately.
- `prefers-reduced-motion: reduce`: every station renders its final pose, state changes are instant swaps, idle loops are off. Covered by an e2e test with emulated reduced motion.
- Pause all idle loops when the tab is hidden and when the station is off screen.

A02 rack:
- Server-rendered final state: bar on the hooks, six plates per side order red, blue, yellow, green, white, black from the inside out, using the side-on plate parts. Plate colours map to the six categories in `buses`. Each plate carries its category name as an SVG `<title>` and in the plain list.
- Entry: plates start 120 px outside each end, slide in and seat inside-first, 90 ms stagger, 220 ms each, ease-out with a 3 px overshoot. After the last plate, the bar translates down 4 px and returns in 180 ms.
- Interaction: plates rotate plus or minus 1.2 degrees for 240 ms, straight bar swaps to the bowed bar part for 160 ms.

A01 character (puppet build, if a01-character-sheet.png exists):
- Rig order: torso, then head, upper arms, forearms, hands, thighs, shins. Child groups nest inside parents so rotations inherit. Pivots from the map file sit on the joint caps.
- Idle: torso scaleY 1 to 1.015 over 4 s, alternate. Blink by swapping the head part for 120 ms at a random interval between 5 and 8 s.
- Entry: right upper arm rotates to raise, forearm waves three times, returns. Then both hands clap once and two chalk puffs fade out.
- Interaction: wave once. On pointer move within the scene, head rotates toward the pointer, clamped to 6 degrees, updated in requestAnimationFrame, disabled on touch and reduced motion.
If only a01b-character-poses.png exists: skip the rig, cross-swap whole poses (idle, wave, chalk) with no tween, and note it in DECISIONS.md.

Lights:
- A placeholder button at the lamp's position toggles `data-lights="off"` on `<html>`, persists in localStorage inside try/catch, respects `prefers-color-scheme` on first visit, and is set by an inline head script to avoid a flash. Palette classes resolve through CSS variables, so the swap is variable-only. Keep contrast at 4.5:1 for all text in both states.

STEP 6. Rules that carry over
- Nothing invented: no metric, link, date or client that is not in content.ts. A missing link renders as no link.
- Links are plain `<a>`, internal page links end with a slash.
- No copy in components.
- Keep the three self-hosted fonts and their roles.
- Rewrite the "Design rules" section of CLAUDE.md for the new direction: flat vector objects with iron outline, eight-colour palette as CSS variables, rounded joins allowed, plate colours still encode the six categories and nothing else, no gradients, no shadows, no emoji, accessibility beats design.

STEP 7. Verification
- Unit: each pipeline stage, manifest schema, scene.ts schema (every station target resolves to a real route or anchor).
- E2E: `/` at 360, 768, 1440 in lights on and off. No horizontal scroll. All twelve stations reachable by Tab in section order with visible focus. Reduced-motion run shows final poses. `/log/` passes the old home suite.
- `pnpm shots`, then review the screenshots yourself for overlap, clipped labels and seams between traced parts. Fix what you find and log each round in docs/PROGRESS.md.
- Lighthouse mobile on `/`: performance 95 or higher, accessibility 100, CLS 0.
- Gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`.

STOP AND REPORT instead of improvising when
- A raw sheet fails keying, or its part count does not match the spec.
- The puppet cannot be rigged without visible gaps at the joints after two pivot passes.
- A budget above cannot be met.
Report with the contact sheet path and a one-line regeneration request I can paste into Gemini.

FINISH
Update docs/PROGRESS.md (state, commands, next task), docs/DECISIONS.md, docs/OPEN_QUESTIONS.md. Push the branch. Do not open a PR.
```

---

## Prompt 2: remaining ten objects

```
Continue on branch `redesign/garage-gym`. Read CLAUDE.md, docs/PROGRESS.md and docs/GARAGE_GYM_ILLUSTRATIONS.md first.

New raw sheets a03 to a12 are in `assets/illustrations/raw/`. For each one:
1. Run `pnpm illustrations <id>`, view the contact sheet, write `assets/illustrations/parts/aNN.json` with names, pivots and z. If the part count does not match the asset's list in the spec, stop for that asset, keep its placeholder, and report a regeneration request. Carry on with the others.
2. Replace the dashed placeholder with the real station. Server-render the final pose.
3. Implement idle, interaction and entry motion exactly as the row for that asset in section 5 of the spec. Same runtime, same rules as A01 and A02: transform and opacity only, one WAAPI timeline per station, reduced-motion final pose, loops paused off screen.

Asset-specific requirements:
- A03 whiteboard: the six numbers are live HTML positioned over the blank board, from `metrics`. Reveal with a clip-path wipe that tracks the marker part. Each number counts up once using the existing counter in src/lib/derive.ts if one fits. Server-rendered state shows all six final values.
- A04 desk: typed lines on the laptop screen are decorative, `aria-hidden`, and built from `ui` strings. Steam and waveform are CSS loops.
- A05 bot: when any station receives hover or focus, the bot's speech label shows that station's plain label. It is a live region with `aria-live="off"`, because the link itself already has that name.
- A08 calendar: each interaction tears one page and shows the next entry from `goals`, wrapping at the end. Server-rendered state shows the first goal.
- A11 timer: shows Asia/Dhaka time as HTML, hydrated on the client, rendered as a fixed placeholder on the server to avoid a hydration mismatch.
- A12 lamp: replace the placeholder lights button. The pull cord is the `<button>`, with `aria-pressed`. The light cone part is visible only when lights are on.

Then:
- Re-check the budgets: illustration SVG for `/` under 250 kB gzipped, first-load JS under 90 kB gzipped, Lighthouse mobile performance 95 or higher, accessibility 100, CLS 0.
- Run `pnpm shots` and review every viewport in both light states. Log the review rounds in docs/PROGRESS.md.
- Generate the Open Graph image from a00-anchor-room.png, cropped to 1200 x 630, name and role set in the display font.
- Gate green, docs updated, branch pushed. No PR, no deploy.
```
