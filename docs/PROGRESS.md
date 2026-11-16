# Progress

Last updated: 2026-11-16. Branch: `redesign/garage-gym` (from `redesign/training-log`, pushed to origin). `main` untouched. Nothing deployed.

## State
- The home page `/` is the Garage Gym: text block, a 1600 x 900 room of twelve stations, the same links as a plain list.
- Eleven of the twelve stations are drawn and animated: A01 character, A02 rack, A03 whiteboard, A05 bot, A06 bike, A07 chalk and logbook, A08 calendar, A09 miss bin, A10 phone, A11 gym kit, A12 lamp. Pegboard and window from A12 hang on the wall as decoration.
- **A04 desk is still a dashed placeholder.** Its sheet was rejected (merged laptop and mic, lost steam wisps). It works as a link.
- Live HTML on blank surfaces: six numbers on the whiteboard, the goals on the calendar, Asia/Dhaka time on the timer.
- Lights: the lamp's pull cord is the button (`aria-pressed`), the light cone shows only with the lights on.
- Rack and character are inline SVG. A03 to A12 are `<use>` references into `public/illustrations/aNN.svg`, attached after first paint, with a `<noscript>` copy.
- `/log/`, `/gym/`, `/notes/`, `/fb-privacy`, `/fb-data-deletion` are untouched. Social image is `public/og.png`, made from the anchor room.

**Exact next task:** regenerate the A04 desk sheet with the request in docs/OPEN_QUESTIONS.md (item 1), then build the desk station. After that, decide the JS budget (item 2).

## Not met, reported instead of worked around
- **First-load JS for `/` is 136.7 kB gzipped, the budget is 90.** A page with only an `<h1>` on this stack ships 133 kB. The garage runtime and the clock are 3.5 kB. Meeting 90 means removing the framework runtime from `/`, a stack decision. See OPEN_QUESTIONS.
- **A04 desk:** no station art, no lid tilt, no typed lines, no steam or waveform. Blocked on the sheet.
- **A01 puppet rig is not built** (unchanged): pose swaps, no blink, no head tracking.
- **Not on the page though on the sheets:** tick mark, pushpin, flag, note, rope, towel, socket, closed logbook, pencil. None is in the motion table.

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
pnpm exec tsx scripts/illustrations/preview.ts bike  # one composed object as PNG, rest pose and all parts, in .illustrations/preview/
pnpm og                  # public/og.png from the anchor room (committed, the build never runs it)
```

## Verification record (2026-11-16, after A03 to A12)
- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 53 passed (content 16, pipeline 25, scene 12).
- `pnpm e2e`: 53 passed. 27 cover `/`, 26 cover the preserved pages.
- Lighthouse, mobile preset, production export, `/`, five runs: performance 95 to 98, accessibility 100, best practices 100, SEO 100. CLS 0. LCP 2.4 to 3.0 s, the element is the `<h1>` name. `/log/` 98, `/gym/` 93 (unchanged, see OPEN_QUESTIONS).
- Budgets for `/`:
  - Illustration SVG 120.1 kB gzipped (budget 250): 21.5 inline (rack, character) plus 98.6 in nine sprite files. Largest object: bike, 25.2 kB. No object over 40 kB, no WebP fallback.
  - First-load JS 136.7 kB gzipped (budget 90, **not met**, see above).
  - HTML 58.8 kB gzipped.
- Sprites checked in Chromium, Firefox and WebKit (Playwright builds), lights on and off.
- Pipeline sheet status: a01 and a04 rejected in their maps, the other eleven emitted.

## Garage review log
Round 1 (found on screenshots at 1440, 1024 and 360, all fixed):
- Traced character had red specks on the neck: a shade tone between skin and red snapped to red. A colour now needs a solid core of its own (a thousandth of the part), otherwise its pixels dissolve into the neighbours.
- Tracing produced 41 layers for 17 rack parts: blended edge pixels formed rim "colours". Same core rule, now 31 layers and a third fewer nodes.
- Labels overflowed their dashed boxes at 1024px (lamp, notes bot, training rules). Footprints widened.
- The platform ran under the desk and into the chalk stool. Shortened.
- Lights off: the iron rack sank into the wall. Wall and lower band lightened one step.
- Lighthouse flagged 77% of phone text under 12px. Mono labels are 12px in the stacked layout.

Round 2, objects A03 to A12 (1440 and 1024 from the live page, 768 and 360 from `pnpm shots`, both light states):
- Calendar drew small and its goal text ran outside the pad: a stacked-layout height rule also applied in the room. Reset there.
- At 1024 the labels of the calendar, the chalk stool and the bin overlapped, the lamp's label covered the rack's top bar and the bot's label covered the desk's. Calendar label moved above the pad, bin label shifted right, cord shortened, bot label and speech moved to the empty wall on its left.
- The light cone read as a second lampshade (thick outline at half opacity). Widened to the shade, shortened to end behind the rack's top, opacity 35%.
- Bot's sound arcs were stacked upside down (smallest on top). Reordered.
- Bike helmet floated above the saddle. Seated.
- Pegboard: tape measure overlapped the hex keys. Moved.
- Phone ring lines showed in the paused idle pose (a keyframe at 0% with opacity 1). The no-JS e2e caught it.
- All parts black in WebKit when drawn from sprites with classes. Fills are inline styles now.

Round 3, mid-motion frames (hover at 250 to 400 ms): underline under the hovered number with the marker at its end, bot speech and arcs, calendar page falling over the next goal, paper ball in flight over the plate, handset lifted with lights out. All as intended.

Checked and fine: plate order and overlap, bar on the hooks, pose alignment on the feet across idle, wave and chalk, mid-entry and mid-hover frames, no seams between stacked fills.

Known and accepted:
- The bike's label sits on its lower frame: there is no free floor around it. At 1024 it covers most of the wheels.
- The bike overlaps the feet of the stool and the bin by a few units. It reads as depth.
- Stacked layout with the lights out: iron parts lose their edge on the near-black page (OPEN_QUESTIONS).
- The whiteboard's writing marker hangs past the board's right edge by design.
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
3. Open a PR from `redesign/garage-gym` into `main`. Vercel builds a preview for the branch: check `/` (in Safari too: the objects are sprite files), `/log/`, `/gym#friday`, `/notes/`, `/fb-privacy`, `/fb-data-deletion`, `/og.png` on the preview URL.
4. In the Vercel project settings: Framework Preset Next.js, Install Command `pnpm install`, Build Command `pnpm build`. The old CRA settings (output directory `build`, `npm run build`) must be cleared. With `output: "export"` Vercel serves `out/` on its own.
5. Merge the PR. Production deploys from `main`.
6. After deploy: open `https://www.arshakil.com/gym#friday` (old URL shape, must land on Friday), re-run Meta's URL check on both `fb-*` pages, and paste the home URL into a link preview checker for `/og.png`.
7. DNS does not change.
