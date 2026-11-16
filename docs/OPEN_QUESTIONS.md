# Open questions

Each has a default already built in. Nothing here blocks the build.

## Garage Gym (2026-11-16)
1. **A04 desk needs a new sheet.** Rejected: the desk is still a dashed box. Contact sheet: `.illustrations/contact/a04.png`. Gemini request: "Regenerate the desk parts sheet. The laptop must be two separate pieces with a wide magenta gap between them: the base alone, and the open lid alone with a blank chalk white screen. The microphone head and its boom arm must be two separate pieces that do not touch. Each of the three steam wisps needs the same thick iron outline as every other part and must be at least as large as the mug handle. 16 separate parts in total, nothing touching." Once it is in `raw/`: write `parts/a04.json`, add `deskLayout` and a `desk` act (lid tilt, typed lines from `ui`, steam and waveform as CSS loops).
2. **JS budget, still not met.** `/` ships 136.7 kB gzipped of first-load JS against a budget of 90 (it was 134.8, the garage runtime grew from 1.6 to 3.5 kB). The floor on Next 16 App Router is 133 kB for an empty page. Options: (a) accept and set the budget at 140, (b) strip the Next and React scripts from `out/index.html` after export and load the garage runtime, the clock and the lights toggle as plain scripts, about 6 kB total, at the cost of a custom post-build step, (c) move the home page off Next. Default now: nothing done, number reported.
3. **Surplus parts accepted on A03, A05, A09, A10** (see DECISIONS). If you read "count does not match" strictly, those four should be placeholders too. Say so and they go back to dashed boxes: remove their maps.
4. **A12 light cone** is a slanted wedge on the sheet, sheared upright in code. Optional Gemini request: "Regenerate the fixtures sheet with the light cone as a symmetric flat trapezoid, narrow at the top, with a thin outline."
5. **A01 puppet sheet.** Rejected, the site uses pose swaps. To get the rig, blink and head tracking, regenerate `a01-character-sheet.png`. Gemini request: "Regenerate the puppet sheet. Every limb must be two separate pieces with a clear magenta gap between them: upper arm and forearm apart, forearm and hand apart, thigh and shin apart, torso and hips as one piece. 16 separate parts in total, nothing touching."
6. **Bike target.** No About section exists. The bike links to `/log/#actual-log` with the flight 07 label, the gym kit links to `/gym/`. Two gym-flavoured stations. Alternative: write the bike line (`offPlatform`) and an About anchor, and point the bike there.
7. **Bot target.** The bot is the narrator and has no section. It links to `/notes/` so the notes have a station. Alternative: the logbook takes `/notes/` and the bot is not a link.
8. **Stacked layout, lights out:** iron parts (rack, bag, calendar header, bike tyres) sit on the near-black page and lose their edge. In the room the wall is lightened for this, the stacked rows use the page background. Options: give the stacked rows the room's wall colour, or accept.
9. **`/log/` has no link back to `/`** except the monogram on other pages. Its own monogram still jumps to the top of the log, because nothing on that page was to change.
10. **Unused sprite files:** `public/illustrations/a01b.svg` and `a02.svg` are written by the pipeline but the page inlines those two objects. 72 kB on disk, never requested.

## Placeholders left unfilled in the prompt
| What | Default now | Where to fill |
| --- | --- | --- |
| Callback AI URL | P-01 renders with no link | `projects` in `src/content.ts`, add `link: { label, href }` |
| create-mvpkit URL | P-14 renders with no link | same |
| Lift URL | P-13 renders with no link, and the "Logged with Lift" line on /gym stays hidden | same, the /gym line appears on its own |
| Bike line for Flight 07 | The "Off the platform" line is not rendered | `offPlatform` in `src/content.ts` |

Filling a project link also needs the unit test "never invents a link" updated (it lists the two ids that have links today).

## Needs a decision
1. **`/hire`.** The project page in brain says the live site has `/hire`. No branch contains it, and the old CRA catch-all served the home page for any path. On the new site `/hire` is a 404. Add a redirect to `/#next-block` if links to it exist.
2. **Hasty Head dates.** Given as "2024 to 2025". The chart draws January 2024 to December 2025. Give months if you want the bar exact.
3. **"No paid pilot yet"** is the CURRENT value for the voice automation pilot goal. Inferred from "first paid pilot". Correct it if a pilot exists.
4. **/gym Lighthouse performance is 93, target 95.** LCP is the first day photo. Options: drop the photo from the first panel, or accept. Home is 96 to 99.
5. **Keyboard shortcuts cannot be switched off.** Fine for Lighthouse, a gap against WCAG 2.1.4. A toggle in the footer would close it.
6. **Old design files** (`design-system/`, `design-system.md`, `assets/`, `PRODUCT.md`) describe the reels design. Delete or archive when this ships.
7. **`redesign/drawing-set` and `fb-legal-pages` branches** are superseded by this branch if it ships. Not touched.
