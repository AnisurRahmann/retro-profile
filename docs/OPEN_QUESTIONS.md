# Open questions

Each has a default already built in. Nothing here blocks the build.

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
