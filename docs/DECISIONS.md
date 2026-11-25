# Decisions

Format: decision · rejected alternative · why.

## Foundation

1. **Rebuild in place on branch `redesign/talk-to-my-agent`, off `main`.** · Branching off `redesign/garage-gym`. · The brief replaces the Garage Gym direction; `main` holds the source-of-truth gym data (`src/data/gym.ts`). The CRA files were removed on this branch only.
2. **Gym data ported into `content.lifts`.** `src/data/gym.ts` (main @ 9fb4a5a): seven days in training-week order (Friday first), headline + emphasis merged into `title` ("Squat (Heavy)"), notes kept, Thursday's program rules moved to `lifts.rules`. Photos and the phone-frame UI were dropped (plain tables per the brief). `/gym` 301s to `/lifts`.
3. **TypeScript 5.9, not 7.0.** · TS 7 (native port) is latest. · Next 16's type plugin and typescript-eslint target 5.x; 7.0 is weeks old.
4. **Dev dependencies beyond the allowed list** (all build/test tooling, none ship to the browser): `typescript`, `@types/*`, `eslint` + `eslint-config-next`, `prettier`, `@tailwindcss/postcss` (required by Tailwind 4), `tsx` (runs `scripts/*.ts` and evals), `yaml` (parses `evals/cases.yaml`; a hand-rolled YAML parser would be a bug farm).
5. **Placeholders resolved in one place (`src/site.ts`).** · Checking `[[` in each component. · One rule set (optional → dropped, required → item hidden, human receipt → excluded) and one test over everything components can see.
6. **Copy includes UI strings.** Nav labels, headings, button labels, chat errors and privacy text live in `content.ui`, so "components never hardcode copy" holds literally and the copy-scan test can be strict.
7. **Portrait fallback.** `public/shakil.jpg` is missing; `Portrait` checks the file at build time and renders an "as" monogram circle instead. No code change needed when the photo lands.
8. **Callback AI URL filled from Shakil's own project notes** (`brain/projects/callback-ai.md`, deployed 2026-09-23) rather than left as a placeholder. Flagged in OPEN_QUESTIONS #4.

## Design

9. **Tile colours** chosen as dark muted mid-tones (luminance below `--graphite`, ≥ 4.5:1 against the `--text` monogram); a vitest computes the ratios from the CSS.
10. **Status line height reserved per breakpoint** (2 lines under 640px, 1 above) so the longest line wrapping never shifts the one-liner. Typed-in remainder is rendered `invisible` so wrapping is final from the first character.
11. **Show-more uses `inert` on the collapsed panel** in addition to `aria-expanded`, so hidden cards can't be tabbed to.
