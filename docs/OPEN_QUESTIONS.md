# Open questions

Each item has the default currently shipped. Values shaped like `[[...]]` in `src/content.ts` are hidden until filled.

| # | Item | Where | Default now |
|---|------|-------|-------------|
| 1 | Portrait `public/shakil.jpg` (square, ≥400px) is missing | `public/` | Monogram "as" circle on a hairline ring. Drop the file in and rebuild; nothing else changes. |
| 2 | Lift URL `[[lift url]]` | `content.shipped` id `lift` | Card renders, not a link. `/lifts` has no Lift link. |
| 3 | create-mvpkit URL `[[create-mvpkit url]]` | `content.shipped` id `create-mvpkit` | Card renders, not a link. |
| 4 | Callback AI URL | `content.building` id `callback-ai` | **Filled** with `https://www.usecallbackai.com` from `brain/projects/callback-ai.md` (deployed 2026-09-23). Confirm or revert to `[[callback url]]`. |
| 5 | Gerald period `[[Aug 2022 – end date]]` | `GERALD_PERIOD` in `content.ts` | Case-study meta line shows org · role only. Agent says it doesn't know the dates. |
| 6 | Lift receipt body (a real voice-logged set) | `receipts` id `r-lift` | Receipt hidden. |
| 7 | Human receipt (name, company, avatar, date, quote) | `receipts` id `r-human-1` | Excluded (any `[[ ]]` → excluded). |
| 8 | Nowash Jawad excerpt + post URL | `receipts` id `r-nowash` | Excluded until both are filled. |
| 9 | `/hire`, `/gym`, blog posts and `fb-*` pages from the old CRA site | — | `/gym` → 301 to `/lifts`. Old blogs, `/hire` and `fb-*` pages are not carried over (not in the brief). Decide before deploy whether any need redirects or a home. |
| 10 | `resume.pdf` from the old site | — | Not carried over. Recover with `git show main:public/resume.pdf > public/resume.pdf` if wanted. |
| 11 | First-load JS target (100 kB gzip) | — | Missed: ~141 kB, of which ~131 kB is the Next/React runtime. Accept, or decide whether the brief's budget should be revised to "framework + ≤ 15 kB site code". |
| 12 | Live evals | `pnpm eval:live` | Not run (no real API calls from the build session). Run follow-up prompt 2 with a key in `.env.local`. |
