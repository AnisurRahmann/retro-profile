# OPEN QUESTIONS

Things the prompt did not resolve. Each has the default that shipped.

## Unfilled placeholders

1. **Gerald end date** (`[[present or end date]]`). Default: `to: null`, rendered "FROM AUG 2022".
   Fix in `src/content.ts`, `experience[0].to` (use `"Present"` or a date).
2. **Callback AI link** (`[[callback url]]`). Default: no link; drawer says "No public link yet".
3. **create-mvpkit link** and **Lift link** (`[[create-mvpkit url]]`, `[[lift url]]`). Default: no link.
   Both are SHIPPED with no public link, which undercuts principle 6 ("Done means a live URL"). Add `link` to P-13 and P-14.

## Copy to confirm

4. **Case study problem lines** were written from the stated before-values. Confirm or replace all five (`caseStudies[].problem`).
5. **Derived and connective copy**: M-01 "21×" (computed), M-05 "About 20% of baseline", M-06 "40% of baseline",
   sheet intros, the transmittal TO line ("Whoever needs a system that survives production"), `meta.ogTitle`.
   Stack entries for projects are only what the prompt states in prose; most projects show a dash.

## Decisions for you

6. **Old routes disappear on deploy**: `/gym`, `/hire`, `/reel`, blogs, `/fb-privacy`, `/fb-data-deletion`.
   If a Facebook app points at the two `fb-*` URLs, they need a home before DNS moves.
7. **`resume.pdf`** was served by the old site and is not linked from the new one. Say if it should return.
8. **REV letter in title blocks** is "E" on every sheet, matching the latest experience revision. Change per sheet in `sheets[].rev`.
9. **Counters show five statuses**, including BUILT / NOT DEPLOYED, where the prompt lists four.
10. **Sheet 07 heading** reads "TRANSMITTAL" with title-block title "CONTACT".
11. **P-25 Untitled Short Film** has a goal (G-15) but no redline text of its own, so it has no red tag on the map.
12. **Email in JSON-LD**: `pshakilwizard@gmail.com` is published in structured data as well as on the page.
