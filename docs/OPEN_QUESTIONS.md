# Open questions

Each has a default already built in. Nothing here blocks the build.

## Garage Gym (2026-11-16), answer before Prompt 2
1. **JS budget.** `/` ships 134.8 kB gzipped of first-load JS against a budget of 90. The floor on Next 16 App Router is 133 kB for an empty page. Options: (a) accept and set the budget at 140, (b) strip the Next and React scripts from `out/index.html` after export and load the 1.6 kB garage runtime and the lights toggle as plain scripts, about 5 kB total, at the cost of a custom post-build step, (c) move the home page off Next. Default now: nothing done, number reported.
2. **A01 puppet sheet.** Rejected, the site uses pose swaps. To get the rig, blink and head tracking, regenerate `a01-character-sheet.png`. Contact sheet: `.illustrations/contact/a01.png`. Gemini request: "Regenerate the puppet sheet. Every limb must be two separate pieces with a clear magenta gap between them: upper arm and forearm apart, forearm and hand apart, thigh and shin apart, torso and hips as one piece. 16 separate parts in total, nothing touching."
3. **A02 has three surplus plates** (second red, blue and chalk face-on plates). Ignored in the map. Nothing to do unless you want a clean sheet.
4. **Bike target.** No About section exists. The bike links to `/log/#actual-log` with the flight 07 label, the gym kit links to `/gym/`. Two gym-flavoured stations. Alternative: write the bike line (`offPlatform`) and an About anchor, and point the bike there.
5. **Bot target.** The bot is the tooltip narrator in the motion table and has no section. It links to `/notes/` so the notes have a station. Alternative: the logbook takes `/notes/` and the bot is not a link.
6. **Pending sheets that do not match the spec count:** a03 (13 components, 10 listed), a04 (13, 16), a05 (16, 10), a09 (8, 7), a10 (9, 8). Extra components are usually loose strokes that can share a name, fewer means merged parts. Check the contact sheets in `.illustrations/contact/` first.
7. **`/log/` has no link back to `/`** except the monogram on other pages. Its own monogram still jumps to the top of the log, because nothing on that page was to change.
8. **Social preview image** is still the Training Log card. `a00-anchor-room.png` is the candidate named in the illustration spec.

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
8. **OG image uses the default sans face,** not Big Shoulders. next/og needs a TTF or OTF and only the WOFF2 is in the repo.
