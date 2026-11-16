# The Garage Gym (arshakil.com)

Personal portfolio. The home page is one illustrated garage gym where every object opens a section. The full training log lives at `/log/`. Next.js App Router, static export. Read `docs/PROGRESS.md` first: it has state, commands and the next task.

## Commands
- Gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e`
- Screenshots: `pnpm shots`. Lighthouse: `node scripts/lighthouse.mjs`.
- Illustrations: `pnpm illustrations` or `pnpm illustrations a02`. Outputs are committed, `pnpm build` never runs it.
- Never commit a red build. Do not deploy or change DNS without being asked.

## Where things live
- `src/content.ts`: all portfolio copy and data, including interface strings (`ui`, garage strings in `ui.garage`). `src/gym.ts`: the gym split, rules and /gym copy.
- `src/schema.ts`: zod schemas. Content is parsed at module load, so bad content fails the build.
- `src/scene.ts`: the twelve stations of the room (placement in a 1600 x 900 space, target, label). Station order is DOM, Tab and phone order.
- `src/lib/derive.ts`: every counter and derived label. `src/lib/notes.ts`, `src/lib/legal.ts`: markdown content readers.
- `src/app/page.tsx`: the garage home. `src/app/log/page.tsx`: the training log (the previous home, unchanged).
- `src/components/`: server components, except `Runtime.tsx`, `Register.tsx`, `LoadTheBarShell.tsx`, `LoadTheBarGame.tsx`, `garage/GarageRuntime.tsx`.
- `src/components/garage/`: header, scene, objects (`RackObject`, `CharacterObject`), plain list, animation runtime.
- `src/illustrations/compose.ts`: how the parts of one object are put together. `src/illustrations/generated/`: pipeline output, do not edit.
- `assets/illustrations/raw/`: Gemini sheets on magenta. `assets/illustrations/parts/aNN.json`: hand-written part maps (name, pivot, z).
- `scripts/illustrations/`: the pipeline (key, split, name, snap, trace, optimise, manifest). Contact sheets and reports go to `.illustrations/`.
- `src/app/globals.css`: the whole design system. The garage block and the `--i-*` palette are at the end.
- `content/blogs/`: posts shown at `/notes`. `content/legal/`: Build Box pages for Meta app review, do not remove.

## Conventions
- No copy in components. Add strings to `ui` in `content.ts` or `GYM_UI` in `gym.ts`.
- Client components never import `content.ts`, `scene.ts` or the illustration manifest (they pull zod into the bundle). Pass data as props, import types with `import type`.
- Custom CSS lives in `@layer components`, so Tailwind utilities win. A class that sets `display` must not be combined with a display utility unless the utility should win.
- Links are plain `<a>`, not `next/link`. Internal page links end with a slash (`/gym/`). Flight links from other pages go to `/log/#id`.
- Runtime dependencies, allowed only: next, react, tailwind, clsx, zod, gray-matter, marked. No UI kits, animation, icon, physics or drag libraries.
- Server-render the final state first. JS only enhances. Anything interactive needs keyboard support and a reduced-motion fallback.
- A new object: drop the sheet in `raw/`, run `pnpm illustrations <id>`, read the contact sheet, write the parts map, run again, add a component and register it in `OBJECTS` in `garage/Scene.tsx`.

### Build-time only (devDependencies, never imported from `src/app` or `src/components`)
- Tests and tooling: vitest, @playwright/test, eslint, typescript, tsx.
- Illustration pipeline: sharp (decode, resize, contact sheets), potrace (tracer, GPL-2.0, tool only), @neplex/vectorizer (VTracer, used by `scripts/illustrations/compare.ts` only), svgo.

## Design rules, short form
- One garage gym, drawn flat: vector objects with a uniform iron outline `#17181A`, flat fills, rounded joins allowed on illustrations. Interface panels, buttons and labels keep square corners and 2px iron borders.
- Eight colours plus skin, as CSS variables `--i-chalk`, `--i-iron`, `--i-grey`, `--i-tan`, `--i-red`, `--i-blue`, `--i-yellow`, `--i-green`, `--i-skin`. Traced paths carry a class (`i-red`), never a hex value. Lights off is a variable swap (`data-lights="off"` on `<html>`).
- Plate colours encode the six project categories and nothing else. Every plate also carries its category name.
- No gradients, no shadows, no emoji. No text inside an illustration: all text is live HTML.
- Every object is a link with a visible label, and every metaphor label is paired with its plain meaning: "LOAD THE BAR · projects". Use `<span className="plain">`.
- Objects without art yet are dashed iron boxes at the object's footprint. They are real links.
- Nothing invented: no metrics, links, dates or clients that are not in the content. A missing link renders as no link.
- Fast first: name, role, six metrics and the call button are text above the room and need no JS or images. The same links follow the room as a plain list.
- From 1024px the room scales as one 16:9 scene. Below that, stations stack in one column. Never a scaled-down room, never sideways scroll.
- Type: Big Shoulders Display 900 uppercase for headings and numbers, Barlow for body at 17px and 62ch, IBM Plex Mono uppercase for labels (11px, 12px in the stacked layout).
- Motion is `transform` and `opacity` on SVG groups, short and physical: plates slide and seat, the bar bends, poses swap. Entries play once, nothing replays on scroll, idle loops pause off screen. Reduced motion gets final poses and instant swaps.
- `/log/`, `/gym/` and `/notes/` keep the earlier chalk-and-iron scoreboard style: circles only for plates and referee lights, plate size encodes status.
- If a design rule conflicts with accessibility, accessibility wins and it is logged in `docs/DECISIONS.md`.
