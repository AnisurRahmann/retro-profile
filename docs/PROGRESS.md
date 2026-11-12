# PROGRESS

Last updated: 2026-11-13. Branch: `redesign/drawing-set` (local only, not pushed, not deployed).

## Status

All phases 0 to 6 in `docs/PLAN.md` are done. The build is green and every check below passes.

**Exact next task:** none in the original scope. Next is your call: answer `docs/OPEN_QUESTIONS.md`
(four unfilled placeholders first), then run a follow-up prompt or deploy.

## Commands

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm e2e                       # 16 Playwright tests against next start on :3100
pnpm shots                     # 12 full-page + 96 per-sheet screenshots into .shots/
pnpm shots 360                 # one width only

# Lighthouse (not a dependency)
pnpm exec next start -p 3100 &
CHROME_PATH="$(node -e "import('@playwright/test').then(m=>console.log(m.chromium.executablePath()))")" \
  pnpm dlx lighthouse http://localhost:3100 --chrome-flags="--headless=new" --view
```

## Final scores (production build, `next start`, 2026-11-13)

| Check                     | Result                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm typecheck`          | pass                                                                                           |
| `pnpm lint`               | pass                                                                                           |
| `pnpm test` (vitest)      | 47 of 47 pass                                                                                  |
| `pnpm build`              | pass, every route static (`/`, `/opengraph-image`, `/sitemap.xml`, `/robots.txt`, `/icon.svg`) |
| `pnpm e2e` (Playwright)   | 16 of 16 pass                                                                                  |
| Lighthouse mobile         | performance 98, accessibility 100, best practices 100, SEO 100                                 |
| Lighthouse desktop        | performance 100, accessibility 100, best practices 100, SEO 100                                |
| CLS                       | 0 (mobile and desktop)                                                                         |
| LCP                       | 1.1 s mobile (simulated throttling), 0.3 s desktop                                             |
| First-load JS, home route | 147.0 kB gzipped, 9 scripts (budget 150 kB). Tight: about 132 kB is React and Next.            |
| Hero canvas               | 0.16 ms mean per frame (budget 4 ms), pauses off screen                                        |

The mobile performance score moved between 97 and 98 across runs.

## Visual review

Screenshots reviewed at 360, 768 and 1440 px, PAPER and BLUEPRINT, redlines ON and OFF.

### Round 1 (after Phase 2 to 4 work)

| Defect                                                                                                    | Fix                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero: blocks so wide that the signal between them was barely visible; token ticks ran over the next block | Narrower blocks, finer signal cells, ticks limited to the gap, wire flat inside each block                                                               |
| Hero at 360px: five blocks on the wire left 6px gaps, signal unreadable                                   | Under 1000px the blocks sit in a row above the wire with dashed leaders                                                                                  |
| Hero pulses rode the waveform and read as glitches                                                        | Pulses now travel along the baseline wire                                                                                                                |
| Map: redline tags collided with the next node's tag                                                       | Tags capped at 18 characters by the schema, font reduced, two tags shortened                                                                             |
| Map: red ID circles missing in sheet crops                                                                | Capture artifact (Playwright resize restarted the draw animation). `shots.ts` now freezes animations. Also dropped `non-scaling-stroke` from map strokes |
| Sheet 02: last flow diagram scaled up to the full sheet width                                             | Capped at 600px                                                                                                                                          |
| Sheet 03: counters wrapped into two ragged rows                                                           | One row from 1100px, redline note moved under the circled counter                                                                                        |
| Sheet 04: stray half-width rule under the table                                                           | Footer paragraph had the 62ch body limit; removed                                                                                                        |
| Sheet 05 and 06: note titles and company names rendered small                                             | CSS targeted `h3`, markup used `h4`                                                                                                                      |
| Sheet crops had the fixed frame stitched through the middle                                               | `shots.ts` hides fixed chrome for per-sheet crops                                                                                                        |

### Round 2 (Phase 6)

| Defect                                                                                                     | Fix                                                                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 360px: "PRODUCTION WORK" broke mid-word                                                                    | Headings under 480px use width 100 and `min(2.5rem, 10.4vw)` (DECISIONS 18)          |
| 360px: "OUTCOMES" broke mid-word in the company block                                                      | Smaller minimum size and width 100 under 480px                                       |
| 360px and 768px: "VERIFIER" overflowed its block                                                           | 8px labels on phones; stacked block layout extended to 1000px                        |
| 360px register: caption squeezed into a narrow column; empty next-revision cells showed a red dash per row | Caption is a block on mobile; empty cells hidden on mobile                           |
| OG image: red circle clipped the first letter of the job title                                             | Text inset, circle shifted                                                           |
| Lighthouse: accessible name of the monogram did not contain its visible text                               | Label now starts with "AR/S"                                                         |
| First-load JS was 178 kB: zod was in the client bundle through a value import                              | Id lists moved to `content.ids.ts` (DECISIONS 9); now 147 kB, guarded by an e2e test |
| Map: red circles touched the node name                                                                     | Circle made shallower                                                                |

### Known and accepted

- Print: each sheet starts on a new A3 landscape page, but sheets 02, 03, 04 and 06 are taller than one page and continue onto the next (22 pages in total). "One sheet per page" holds for the shorter sheets only.
- Redline OFF on sheet 06 leaves the intro sentence ("drawn in red") visible in grey above the notice.
- BLUEPRINT hatch is low contrast by design; node status is also carried by the label in the register and drawer.
- Stamps appear in the detail drawer only. The map and register use the line-style swatch, since 27 rotated stamps in a table read as noise.
- The whole build landed as one commit at the end of the session, not one or more per phase. Splitting it afterwards would have produced intermediate commits that were never built.

## Open questions

See `docs/OPEN_QUESTIONS.md`. Needed before deploy:

1. Gerald end date, or "Present".
2. Callback AI URL.
3. create-mvpkit URL and Lift URL (both are SHIPPED with no link).
4. Whether `/fb-privacy` and `/fb-data-deletion` must keep working on arshakil.com.

## Deploy to Vercel (not done; do not run without deciding the open questions)

```bash
# 1. Confirm green
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e

# 2. Push the branch (first push of this branch)
git push -u origin redesign/drawing-set

# 3. Preview deploy. The existing Vercel project for this repo is configured for Create React App,
#    so set Framework Preset to Next.js, Build Command to `pnpm build`, Install Command to `pnpm install`,
#    Output Directory to the default (not `build`).
pnpm dlx vercel            # preview URL; check it on a phone

# 4. Production
git checkout main && git merge --no-ff redesign/drawing-set && git push origin main
pnpm dlx vercel --prod     # or let the Git integration deploy main

# 5. Domain: arshakil.com should already point at the Vercel project. If not:
pnpm dlx vercel domains add arshakil.com
```

After deploy: open https://arshakil.com/opengraph-image, test the link preview, and submit the sitemap.
