# The Training Log (arshakil.com)

Personal portfolio structured as a training log. Next.js App Router, static export. Read `docs/PROGRESS.md` first: it has state, commands and the next task.

## Commands
- Gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- E2E (after build): `pnpm e2e`. Screenshots: `pnpm shots`. Lighthouse: `node scripts/lighthouse.mjs`.
- Never commit a red build. Do not deploy or change DNS without being asked.

## Where things live
- `src/content.ts`: all portfolio copy and data, including interface strings (`ui`). `src/gym.ts`: the gym split, rules and /gym copy.
- `src/schema.ts`: zod schemas. Content is parsed at module load, so bad content fails the build.
- `src/lib/derive.ts`: every counter and derived label. `src/lib/notes.ts`, `src/lib/legal.ts`: markdown content readers.
- `src/components/`: server components, except `Runtime.tsx`, `Register.tsx`, `LoadTheBarShell.tsx`, `LoadTheBarGame.tsx`.
- `src/app/globals.css`: the whole design system.
- `content/blogs/`: posts shown at `/notes`. `content/legal/`: Build Box pages for Meta app review, do not remove.

## Conventions
- No copy in components. Add strings to `ui` in `content.ts` or `GYM_UI` in `gym.ts`.
- Client components never import `content.ts` (it pulls zod into the bundle). Pass data as props, import types with `import type`.
- Custom CSS lives in `@layer components`, so Tailwind utilities win. A class that sets `display` must not be combined with a display utility unless the utility should win.
- Links are plain `<a>`, not `next/link`. Internal page links end with a slash (`/gym/`).
- Allowed dependencies only: next, react, tailwind, clsx, zod, gray-matter, marked, vitest, @playwright/test. No UI kits, animation, icon, physics or drag libraries.
- Server-render the final state first. JS only enhances. Anything interactive needs keyboard support and a reduced-motion fallback.

## Design rules, short form
- Chalk, iron, plates: meet scoreboard crossed with a gym whiteboard. Square corners, 2px iron borders. No shadows, no gradients, no radius on panels, no emoji.
- Circles are only plates and referee lights.
- Plate colours encode the six project categories and nothing else. Every plate also carries its category name.
- Plate size encodes project status. Five fixed sizes.
- Every metaphor label is paired with its plain meaning: "GOOD LIFT · shipped". Use `<span className="plain">`.
- Nothing invented: no metrics, links, dates or clients that are not in the content. A missing link renders as no link.
- Fast first: name, role, six PRs and the call button without interacting. Each game has a skip link and its content exists outside the game.
- Type: Big Shoulders Display 900 uppercase for headings and numbers, Barlow for body at 17px and 62ch, IBM Plex Mono 11px uppercase for labels.
- Motion is short and physical: plates slide and seat, the bar bends, lights switch on 90ms apart, numbers count once. Nothing fades in on scroll.
- If a design rule conflicts with accessibility, accessibility wins and it is logged in `docs/DECISIONS.md`.
