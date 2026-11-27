# Volumetric clouds lab: task board

Read `BRIEF.md` first. `plan.json` is the machine-readable copy of this board, and its `owns` globs are binding. The
table below is static. Each task updates only its own section, between its `<!-- Tn -->` markers, so parallel merges
don't collide. The detail goes in `handoffs/<id>.md`.

| Task | Agent | Depends on | Owns (summary) | Prompt |
| --- | --- | --- | --- | --- |
| **T0** Brief, interfaces, lab skeleton | Claude Code | none | `types.ts`, `renderer.ts`, `assemble.ts`, `debug-views.ts`, `common.glsl.ts`, `scene.ts`, `gate.ts`, the lab page shell, docs | `prompts/T0.md` |
| **T1** Noise textures on the GPU | GLM | T0 | `src/lib/sky/volumetric/noise/**`, `noise-gpu.ts`, `vol-noise.test.ts` | `prompts/T1.md` |
| **T2** Weather map | GLM | T0 | `src/lib/sky/volumetric/weather-map.ts`, `vol-weather-map.test.ts` | `prompts/T2.md` |
| **T3** Lab controls and URL state | GLM | T0 | `src/app/lab/clouds/controls/**`, `lab-state.ts`, `vol-lab-state.test.ts` | `prompts/T3.md` |
| **T4** March, density, lighting | Claude Code | T0 | `march.glsl.ts`, `density.glsl.ts`, `lighting.glsl.ts` | `prompts/T4.md` |
| **T5** Sun, moon, stars behind the clouds | Claude Code | T0, T4 | `background.glsl.ts`, `sun-cell.ts`, `lab-cloud-at-sun.spec.ts` | `prompts/T5.md` |
| **T6** Lab screenshots and GPU probe | GLM | T0, T3 | `scripts/probe/lab-*.mts`, `package.json` scripts, BRIEF "Tools" (append) | `prompts/T6.md` |
| **M1** Review of T1–T6 | Claude Code | T1–T6 | everything volumetric (review fixes), DECISIONS, PROGRESS | `prompts/M1.md` |
| **T7** Performance | Claude Code | M1 | `targets.ts`, `reproject.glsl.ts`, `tiers.ts`, `vol-tiers.test.ts` | `prompts/T7.md` |
| **T8** Visual tuning, then the owner's review | Claude Code | T7 | the `*.glsl.ts` constants and shaping, `weather-map.ts` coverage mapping, DECISIONS, PROGRESS | `prompts/T8.md` |

**Order.** T1, T2, T3 and T4 can run in parallel once T0 is merged. T5 needs T4, and T6 needs T3. M1 waits for all
six. Then T7, then T8. T8 ends with status `needs-human`: the owner reviews the lab before anything reaches the home
page.

**Statuses:** `todo` · `in-progress` · `done` · `partial` · `blocked` · `needs-human`.

---

<!-- T0 -->
### T0: brief, interfaces, lab skeleton

**Status:** done (2026-11-27, `feat/volumetric-lab`)

**Files:**
- `docs/volumetric/{BRIEF.md, TASKS.md, plan.json, handoffs/T0.md}`
- `src/components/sky/volumetric/{types, renderer, assemble, debug-views, common.glsl}.ts`
- `src/lib/sky/volumetric/{scene, gate}.ts`
- `src/app/lab/clouds/{page, LabClient}.tsx`
- Typed placeholders in every later task's file
- Tests: `tests/unit/vol-{assembly, gate, scene}.test.ts`, `tests/e2e/lab-smoke.spec.ts`

**Done when:**
- The gates are green.
- `/lab/clouds` draws the gradient with a placeholder sun.
- `lab-smoke` passes.
- Every later task's file exists as a typed placeholder.
- The assembly test enforces the GLSL contract.

**How to verify:**
- `pnpm vitest run tests/unit/vol-*.test.ts`
- `pnpm e2e:only tests/e2e/lab-smoke.spec.ts` after `pnpm build:e2e`
- Open `http://localhost:<port>/lab/clouds`

**Notes for the next tasks:**
- Contract and placeholder notes: see `handoffs/T0.md`.
- The gradient bands in 8 bits until T5 dithers it.
- T4 starts on flat noise, so it needs `VOL_TEMP_NOISE`.
<!-- /T0 -->

<!-- T1 -->
### T1: noise textures on the GPU

**Status:** done (2026-11-27, `vol/T1-noise`)

**Files:**
- `src/lib/sky/volumetric/noise/recipes.ts`: the octave tables and two contrast constants; one table drives GPU and CPU
- `src/lib/sky/volumetric/noise/reference.ts`: the CPU reference (hash, Perlin, Worley, the channel recipes)
- `src/lib/sky/volumetric/noise/glsl.ts`: the fragment sources, written out from the recipes; the slice viewer's main
- `src/lib/sky/volumetric/noise/blue.ts`: void-and-cluster blue noise, made once per session
- `src/lib/sky/volumetric/noise/layout.ts`: the slice viewer's tile layout (pure)
- `src/lib/sky/volumetric/noise/index.ts`: the barrel
- `src/components/sky/volumetric/noise-gpu.ts`: `createNoiseTextures` (slices through a framebuffer, mipmaps, timing,
  a per-context cache) and the `noise` debug view
- Tests: `tests/unit/vol-noise.test.ts` (59)
- `docs/volumetric/handoffs/T1.md`

**How to verify:**
- `pnpm vitest run tests/unit/vol-noise.test.ts`: tileability, range, hash quality, recipes, GLSL, blue noise, layout
- With a dev server: `http://localhost:<port>/lab/clouds?debug=noise` (add `&tier=medium` or `&tier=low`). Eight labelled
  slices and a z slider (keyboard: Home, End, arrows). The console has one `[vol] noise <tier>: … ms` line per load.
- `.shots/volumetric-lab/T1-noise.png` (1440×900).
- GPU against CPU: 0.5/255 apart, the numbers are in `handoffs/T1.md`.

**Notes for the next task:**
- T4: `texture(uShape, p).r` is Perlin-Worley, `.gba` Worley fbm from 2, 4 and 8 cells per tile; `texture(uDetail, p).rgb`
  is Worley fbm from 2, 4 and 8. Every channel spans 0..1. R is 0 in 52% of the volume (clear air) and reaches 1 in
  its dense cores; the Worley fbm channels have their median at 0.45.
- Mip chains exist, for `textureLod` on far steps. MIN_FILTER stays LINEAR, so `texture()` reads level 0.
- 64³ and 128³ are the same noise; 128³ adds one octave each to SHAPE's R (Perlin at 32) and A.
- A browser's first load compiles the shaders, which took 160–900 ms here; every load after is under 100 ms. See
  "Known issues" in the hand-off.
<!-- /T1 -->

<!-- T2 -->
### T2: weather map

**Status:** todo

**Done when:**
- `generateWeatherMap` is deterministic per seed and produces clustered patches. Stratus is near-uniform. Cumulonimbus
  has 1–2 strong cells. Precipitation sits under the dense cells.
- `forcedCell` reaches coverage ≥ 0.95 at its centre and wraps across the edges.
- Mean coverage: cumulus at 0.38 stays within 0.30–0.46; stratus at 0.95 reaches at least 0.9.
- `offset` and `velocity` follow the wind (from 270 means +u), with `WIND_TIMELAPSE` documented.
- The map is regenerated only when the params change.
- `tests/unit/vol-weather-map.test.ts` covers all of this.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the next task:** (fill in)
<!-- /T2 -->

<!-- T3 -->
### T3: lab controls and URL state

**Status:** todo

**Done when:**
- `parseLabState` and `serialiseLabState` round-trip, the defaults are state A, and invalid values clamp.
- The panel (fixed top-right, collapsible, Geist Mono 12px, tokens only) covers every `LabState` field, presets A–C,
  the sun elevation (from `astro.ts`) and the GPU / CPU ms readout (`onFrameTime`).
- Every change calls `renderer.setState` and `history.replaceState`.
- It is keyboard-accessible and every control is labelled.
- `.shots/volumetric-lab/T3-controls.png` exists.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the next task:** (fill in)
<!-- /T3 -->

<!-- T4 -->
### T4: march, density, lighting

**Status:** todo

**Done when:**
- State A shows lit tops, darker bases, clouds shrinking to the horizon and no banding. Use `VOL_TEMP_NOISE` (in
  `density.glsl.ts`, helpers prefixed `density`) until T1 and T2 are merged.
- The contract functions are implemented and the assembly test is green.
- `.shots/volumetric-lab/T4-*.png` at 1440×900 have been looked at.
- The hand-off lists the uniforms used and where `VOL_TEMP_NOISE` must be removed.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the next task:** (fill in)
<!-- /T4 -->

<!-- T5 -->
### T5: sun, moon and stars behind the clouds

**Status:** todo

**Done when:**
- The sun (limb darkening, bloom at 3 radii), the moon (phase, terminator, earthshine, glow) and the seeded,
  twinkling stars match the look of `bodies.ts` and `particles.ts`.
- The gradient is dithered.
- `final = cloud.rgb + cloud.a × background`.
- `forcedCellFor` (in `sun-cell.ts`) handles `cover` and `edge`.
- `tests/e2e/lab-cloud-at-sun.spec.ts` passes: the disc centre loses at least 85% of its brightness.
- Screenshots in `.shots/volumetric-lab/T5-*.png`: B with and without `cloudAtSun`, and 20:30 with the moon.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the next task:** (fill in)
<!-- /T5 -->

<!-- T6 -->
### T6: lab screenshots and GPU probe

**Status:** todo

**Done when:**
- `pnpm lab:shots` captures A, B and C at 1440×900 and 375×812 on the high, medium and low tiers, plus two frames of
  A 10 s apart, into `.shots/volumetric-lab/run-<ts>/`, with a contact sheet.
- `pnpm lab:gpu` prints and writes the GPU ms table, per state and tier, at 1920×1080 DPR 2 and 375×812 DPR 3.
- Both have been run once against the dev server.
- BRIEF.md has a "Tools" section appended.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the next task:** (fill in)
<!-- /T6 -->

<!-- M1 -->
### M1: review of T1–T6

**Status:** todo

**Done when:**
- Each of T1–T6 has been checked against `types.ts` and BRIEF.md. Small fixes are made; bigger ones are follow-ups
  with an owner.
- Requests for M1 are applied or rejected with a reason.
- The hand-off decisions are carried into `docs/DECISIONS.md`.
- `VOL_TEMP_NOISE` is removed.
- `pnpm lab:shots` and `pnpm lab:gpu` have been run and the contact sheet looked at.
- The status is `needs-human` if a follow-up blocks T7.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the next task:** (fill in)
<!-- /M1 -->

<!-- T7 -->
### T7: performance

**Status:** todo

**Done when:**
- Clouds render to an RGBA16F target at the tier scale.
- 2×2 checkerboard reprojection with α 0.25 and a neighbourhood clamp.
- Re-march at ≤ 15 Hz, with a bilateral upsample.
- Automatic tiers step down after 20 ms for 3 s, and the change is logged.
- `pnpm lab:gpu`: high ≤ 2.5 ms (1920×1080 DPR 2) and low ≤ 3 ms (375×812 DPR 3), with a before/after table.
- Two frames 10 s apart show no ghosting.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the next task:** (fill in)
<!-- /T7 -->

<!-- T8 -->
### T8: visual tuning, then the owner's review

**Status:** todo

**Done when:**
- Two review rounds are recorded: PASS/FAIL per checklist item, per state and size, with shot paths.
- Only constants and shaping functions were changed.
- The `pnpm lab:gpu` budgets still hold.
- The hand-off lists the 3 URLs, the contact sheet, the GPU table and an honest list of what still doesn't look real.
- Status `needs-human`; nothing integrated into the home page.

**Files:** (fill in) · **How to verify:** (fill in) · **Notes for the owner:** (fill in)
<!-- /T8 -->
