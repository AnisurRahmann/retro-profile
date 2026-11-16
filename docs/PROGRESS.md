# Progress

Last updated: 2026-11-16. Branch: `redesign/garage-gym` (from `redesign/training-log`, pushed to origin). `main` untouched. Nothing deployed.

## State
- The home page `/` is the Garage Gym: text block, a 1600 x 900 room of twelve stations, the same links as a plain list.
- The previous home (The Training Log) lives unchanged at `/log/`. `/gym/`, `/notes/`, `/fb-privacy`, `/fb-data-deletion` are untouched.
- Illustration pipeline works end to end (`pnpm illustrations`). Traced and live: A02 rack (17 parts, 9.0 kB gzipped) and A01 character from the pose sheet a01b (6 parts, 19.7 kB gzipped).
- Ten stations (A03 to A12) are dashed placeholders that already link. Their raw sheets are in `assets/illustrations/raw/` and key and split cleanly, but have no parts map yet.
- Lights: the lamp placeholder toggles `data-lights="off"` and `data-theme="dark"` together.

**Exact next task:** Prompt 2 in docs/GARAGE_GYM_BUILD_PROMPTS.md (objects A03 to A12). For each sheet: open `.illustrations/contact/aNN.png` after `pnpm illustrations`, write `assets/illustrations/parts/aNN.json`, run again, add the object component, register it in `OBJECTS` in `src/components/garage/Scene.tsx`. Before that, answer the open questions at the top of docs/OPEN_QUESTIONS.md (JS budget, A01 puppet sheet, bike and bot targets).

## Not met, reported instead of worked around
- **First-load JS for `/` is 134.8 kB gzipped, the budget was 90.** A page with only an `<h1>` on this stack ships 133 kB (React 19 plus the Next 16 App Router runtime). The garage runtime adds 1.6 kB. Meeting 90 means removing the framework runtime from `/`, which is a stack decision. See OPEN_QUESTIONS.
- **A01 puppet rig is not built.** `a01-character-sheet.png` splits into 14 components against 16 in the spec: arms and legs are single pieces, so there is no elbow, wrist or knee. The site uses whole-pose swaps from `a01b`. No blink and no head tracking: they need separate head parts.

## Commands
```bash
pnpm install
pnpm dev                 # local dev server
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e   # the gate, build writes ./out, e2e runs against it
pnpm shots               # full-page screenshots into .shots/ (360, 768, 1440, both themes, plus game states)
python3 scripts/tile-shots.py .shots/log-1440-light.png 1500   # cut a tall shot into reviewable tiles (needs Pillow)
node scripts/lighthouse.mjs   # Lighthouse on /, /log/ and /gym/, reports in .lighthouse/
pnpm serve               # serve ./out on :4173
pnpm illustrations       # every raw sheet: contact sheets into .illustrations/contact/, SVG parts and manifest into src/illustrations/generated/
pnpm illustrations a02   # one sheet
pnpm exec tsx scripts/illustrations/compare.ts a02   # tracer comparison, previews in .illustrations/compare/
```

## Verification record (2026-11-16)
- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 48 passed (content 16, pipeline 23, scene 9).
- `pnpm e2e`: 46 passed. The 26 earlier tests now run against `/log/`, 20 new ones cover `/`.
- Lighthouse, mobile preset, production export:
  - `/`: performance 99, accessibility 100, best practices 100, SEO 100. CLS 0. LCP 2.1 s, the element is the `<h1>` name.
  - `/log/`: performance 95 to 96, accessibility 100. `/gym/`: 93, unchanged.
- Budgets for `/`: inline illustration SVG 19.1 kB gzipped (budget 250). No object over 40 kB, so no WebP fallback was needed. First-load JS 134.8 kB gzipped (budget 90, not met, see above). HTML is 49 kB gzipped: the SVG paths are in it twice, once as markup and once in the React payload.
- Pipeline sheet status: a01 rejected in its map, a01b and a02 emitted, a03 to a12 pending (no map). Component counts seen for the pending sheets against the parts listed in the spec: a03 13 of 10, a04 13 of 16, a05 16 of 10, a06 8 of 8, a07 12 of 12, a08 5 of 5, a09 8 of 7, a10 9 of 8, a11 7 of 7, a12 10 of 10. The ones that differ need a look at the contact sheet before a map is written.

## Garage review log
Round 1 (found on screenshots at 1440, 1024 and 360, all fixed):
- Traced character had red specks on the neck: a shade tone between skin and red snapped to red. A colour now needs a solid core of its own (a thousandth of the part), otherwise its pixels dissolve into the neighbours.
- Tracing produced 41 layers for 17 rack parts: blended edge pixels formed rim "colours". Same core rule, now 31 layers and a third fewer nodes.
- Labels overflowed their dashed boxes at 1024px (lamp, notes bot, training rules). Footprints widened.
- The platform ran under the desk and into the chalk stool. Shortened.
- Lights off: the iron rack sank into the wall. Wall and lower band lightened one step.
- Lighthouse flagged 77% of phone text under 12px. Mono labels are 12px in the stacked layout.

Checked and fine: plate order and overlap, bar on the hooks, pose alignment on the feet across idle, wave and chalk, mid-entry and mid-hover frames, no seams between stacked fills.

Known and accepted:
- The rack is one flat iron shape. Its inner lines and holes are the same colour as its outline, so they do not survive palette snapping.
- The bowed bar was drawn shorter and thicker than the straight one. It is stretched to length and shows for 160 ms.
- Side-on plates are drawn at 0.7 scale and overlap, so six fit on the sleeve. The outline is a little lighter than on the rack.
- Off palette, reported by the pipeline: the centre holes of the face-on plates are dark purple (`#52174B`) and the red plate has a dark red shade. Both snap to iron. The face-on plates are not on the page yet.

## Verification record (2026-11-13, Training Log, before the move to /log/)

- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 16 passed.
- `pnpm e2e`: 26 passed.
- Lighthouse, mobile preset, production export:
  - `/`: performance 96 to 99 across runs, accessibility 100, best practices 100, SEO 100. CLS 0.
  - `/gym/`: performance 93, accessibility 100, best practices 100, SEO 100. Below the 95 target: LCP is the first day photo (3.2 s simulated). See OPEN_QUESTIONS.
- First-load JS for home: 140.4 kB gzipped transfer (budget 150). The Load the Bar game is a separate chunk loaded when the section nears the viewport. zod is not in any client chunk.

## Training Log design review log
Round 1 (found on screenshots, all fixed):
- Hero name wrapped to two lines on desktop and left half the row empty. Now one line from 768px, two lines on phones.
- Hero bar plates ran off both viewport edges. Bar now sits inside padding.
- "MILLIONS" overflowed its cell in the six-PR strip. Type scale reduced.
- PR cards: PREVIOUS value collided with the NEW value, label columns differed per card. Rebuilt as stacked label over value, values bottom-aligned.
- Rack: idea-size plates clipped their own text, plates in a row were top-aligned. Sizes and stamp type retuned, plates centred in a fixed slot.
- Register status label wrapped to five lines. Lights now sit above the label.
- 360px: page scrolled sideways (closed flights menu, status select, scoreboard count). All three fixed, e2e guards it.
- Gym tables had different column widths per day and a doubled border. Fixed layout and border.
- Custom CSS was unlayered and silently beat Tailwind utilities. Moved into `@layer components`.

Round 2:
- Phones: tapping a plate showed the result far below the rack. Bar now sits above the rack and the detail card pins to the bottom of the screen. The first attempt did not pin (sticky was trapped in a grid cell, then a utility beat the layered rule); the touch e2e caught both.
- Lighthouse a11y: accessible names did not contain the visible text (monogram, lights toggle, plates), small touch targets (hero plates, gym day links, register links), heading order on /gym. All fixed, accessibility is 100.
- Display font: the 58 kB variable file made the name the late LCP. Swapped to a 14 kB instance pinned at opsz 72, wght 900. A plain static 900 was tried first and rejected: it is the wide text cut and overflowed.
- Gym photos were the /gym LCP at 200 to 350 kB. Grayscale WebP derivatives, 27 to 70 kB.
- Print palette was beaten by the theme tokens. Moved out of the layer.
- Hero path buttons wrapped badly at 768px. Label now sits over its plain label.

Known and accepted:
- A flow diagram that wraps shows a connector at the start of the second row.
- Radios in Your Call are square (circles are reserved for plates and lights).

## Deploy steps (not run: nothing is deployed, no hosting project was created or changed)
The live site is on Vercel and the apex redirects to `https://www.arshakil.com`.
1. Fill or confirm docs/OPEN_QUESTIONS.md. Decide on `/hire` and the canonical host.
2. `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`.
3. Open a PR from `redesign/garage-gym` into `main`. Vercel builds a preview for the branch: check `/`, `/log/`, `/gym#friday`, `/notes/`, `/fb-privacy`, `/fb-data-deletion`, `/og.png` on the preview URL.
4. In the Vercel project settings: Framework Preset Next.js, Install Command `pnpm install`, Build Command `pnpm build`. The old CRA settings (output directory `build`, `npm run build`) must be cleared. With `output: "export"` Vercel serves `out/` on its own.
5. Merge the PR. Production deploys from `main`.
6. After deploy: open `https://www.arshakil.com/gym#friday` (old URL shape, must land on Friday), re-run Meta's URL check on both `fb-*` pages, and paste the home URL into a link preview checker for `/og.png`.
7. DNS does not change.
