# Progress

Last updated: 2026-11-13. Branch: `redesign/training-log` (pushed to origin). `main` untouched.

## State
All phases 0 to 5 in docs/PLAN.md are done. Nothing is in progress.

**Exact next task:** fill the placeholders in docs/OPEN_QUESTIONS.md (four links, the bike line), then deploy (steps below). After that, follow-up prompts F3 to F5.

## Commands
```bash
pnpm install
pnpm dev                 # local dev server
pnpm typecheck && pnpm lint && pnpm test && pnpm build   # the gate, build writes ./out
pnpm e2e                 # Playwright against ./out (run pnpm build first)
pnpm shots               # full-page screenshots into .shots/ (360, 768, 1440, both themes, plus game states)
python3 scripts/tile-shots.py .shots/home-1440-light.png 1500   # cut a tall shot into reviewable tiles (needs Pillow)
node scripts/lighthouse.mjs   # Lighthouse on / and /gym/, reports in .lighthouse/
pnpm serve               # serve ./out on :4173
```

## Verification record (2026-11-13)
- `pnpm typecheck`, `pnpm lint`: clean.
- `pnpm test`: 16 passed.
- `pnpm e2e`: 26 passed.
- Lighthouse, mobile preset, production export:
  - `/`: performance 96 to 99 across runs, accessibility 100, best practices 100, SEO 100. CLS 0.
  - `/gym/`: performance 93, accessibility 100, best practices 100, SEO 100. Below the 95 target: LCP is the first day photo (3.2 s simulated). See OPEN_QUESTIONS.
- First-load JS for home: 140.4 kB gzipped transfer (budget 150). The Load the Bar game is a separate chunk loaded when the section nears the viewport. zod is not in any client chunk.

## Design review log
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
3. Open a PR from `redesign/training-log` into `main`. Vercel builds a preview for the branch: check `/`, `/gym#friday`, `/notes/`, `/fb-privacy`, `/fb-data-deletion`, `/og.png` on the preview URL.
4. In the Vercel project settings: Framework Preset Next.js, Install Command `pnpm install`, Build Command `pnpm build`. The old CRA settings (output directory `build`, `npm run build`) must be cleared. With `output: "export"` Vercel serves `out/` on its own.
5. Merge the PR. Production deploys from `main`.
6. After deploy: open `https://www.arshakil.com/gym#friday` (old URL shape, must land on Friday), re-run Meta's URL check on both `fb-*` pages, and paste the home URL into a link preview checker for `/og.png`.
7. DNS does not change.
