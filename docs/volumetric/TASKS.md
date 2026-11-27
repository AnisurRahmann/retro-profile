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

**Status:** done (2026-11-27, `vol/T2-weather-map`)

**Files:**
- `src/lib/sky/volumetric/weather-map.ts`: `generateWeatherMap` (pure, seeded, tileable), `windVelocity` +
  `WIND_TIMELAPSE` (15, documented), `createWeatherMap` (LINEAR/REPEAT upload; regenerates only when the field
  params change — the wind only scrolls)
- Tests: `tests/unit/vol-weather-map.test.ts` (30)
- `docs/volumetric/handoffs/T2.md`

**How to verify:**
- `pnpm vitest run tests/unit/vol-weather-map.test.ts`: determinism, the mean windows (cumulus@0.38, stratus@0.95),
  the cumulonimbus cells, the forcedCell wrap, precipitation concentration, the wind scroll, regeneration
- All five gates green, plus `pnpm build:e2e` + `pnpm e2e:only tests/e2e/lab-smoke.spec.ts` (the real WebGL path)
- No lab screenshot: `?debug=weather` is T4's in-shader view, so T2 ships no JS view of its own

**Notes for the next task:**
- T4: `weatherAt` gives (coverage, type, precipitation) per texel, and the type channel varies per texel: stratus 0,
  cumulus 0.5; a cumulonimbus sky is a cumulus-grade field with its 1–2 seeded cells stamped to type 1, and a
  forcedCell stamps type 0.5. Read the map's G, not just `uCloudType`.
- Measured statistics (bytes, every seed): cumulus@0.38 → mean 0.377, 24% clear (< 0.02), 44% cores (> 0.5), ceiling
  0.718; stratus@0.95 → mean 0.94–0.95, deck 0.66–1.0, no holes. Precipitation = param × smoothstep(0.45, 0.95, cov).
- The generator calibrates the noise per map (percentile rank for the patchy field, z-score for stratus), so
  `coverage` is the map's mean target for every seed — which is what types.ts documents the param to be.
- `WIND_TIMELAPSE` went 6 → 15: 15 km/h crosses the 40-km tile in ~10.7 min, so T6's frames 10 s apart drift ~2 texels.
<!-- /T2 -->

<!-- T3 -->
### T3: lab controls and URL state

**Status:** done (2026-11-27, `vol/T3-lab-controls`, M1 follow-up F1)

**Files:**
- `src/lib/sky/volumetric/lab-state.ts`: parse/serialise with clamping to the documented ranges, real calendar dates,
  strict `HH:MM`, integer seeds; `cloudAtSun` accepts `cover` as a synonym for `1` (F1); `presetState` = defaults +
  `LAB_PRESETS`, i.e. the §7 acceptance URLs.
- `src/app/lab/clouds/controls/index.tsx`: the panel — presets A–C and every `LabState` field, the real sun's
  elevation (Asia/Dhaka, `astro.ts`), the frame-time readout (timer-query GPU ms, else rAF ms, plus tier), collapse
  remembered per session. Every change → one `renderer.setState` + `history.replaceState` per animation frame (T7's
  throttle note).
- `src/app/lab/clouds/controls/widgets.tsx`: the labelled primitives (Section, Slider, Seg, Toggle, NumField,
  SelectField, DateField, FrameReadout).
- Tests: `tests/unit/vol-lab-state.test.ts` (16).
- `docs/volumetric/handoffs/T3.md`

**How to verify:**
- `pnpm vitest run tests/unit/vol-lab-state.test.ts`; all five gates green.
- Open the lab, click "controls +": drag a slider, click a preset — the URL and the render follow (`window.__vol.state`).
- `.shots/volumetric-lab/T3-controls.png` (1440×900, panel expanded over state A).

**Notes for the next task:**
- The panel starts **collapsed** (sessionStorage) so `lab:shots` / `lab:gpu` keep a clean corner; only the small
  "controls +" pill and the ms readout show.
- Preset buttons apply the §7 acceptance states exactly, so `debug`, `view` and `tier` reset with them.
- The type group abbreviates cumulonimbus as "cb" (title has the full word); the debug select lists
  `SHADER_DEBUG_VIEWS` + "noise".
- Keyboard: native inputs and buttons throughout; sliders arrow-step (time 5 min, coverage 0.01).
<!-- /T3 -->

<!-- T4 -->
### T4: march, density, lighting

**Status:** done (2026-11-27, `vol/T4-core`)

**Done when:**
- State A shows lit tops, darker bases, clouds shrinking to the horizon and no banding. Use `VOL_TEMP_NOISE` (in
  `density.glsl.ts`, helpers prefixed `density`) until T1 and T2 are merged.
- The contract functions are implemented and the assembly test is green.
- `.shots/volumetric-lab/T4-*.png` at 1440×900 have been looked at.
- The hand-off lists the uniforms used and where `VOL_TEMP_NOISE` must be removed.

**Files:**
- `march.glsl.ts`: shell span, geometric steps, blue-noise jitter, early exit, debug views.
- `density.glsl.ts`: per-type gradient, anvil, coverage remap, erosion, wind and shear, temporary noise.
- `lighting.glsl.ts`: 6-step light march, multi-scatter octaves, dual-lobe HG, powder, two-stream diffuse term,
  ambient, aerial perspective.

**How to verify:**
- `pnpm vitest run tests/unit/vol-assembly.test.ts`
- `/lab/clouds?t=11:00&type=cumulus&cov=0.38&freeze=1`, with `&view=345` or `&debug=weather|density|transmittance|light|depth`
- Shots, from `.shots/volumetric-lab/`:
  - `T4-{A,A-away,A-side,B,C,night}.png`: temporary noise.
  - `T4-real-*.png`: on T1's and T2's real textures, overlaid temporarily and not committed.
  - `T4-debug-views.png`.

**Known issues:**
- Per-frame jitter grain until T7's reprojection.
- GPU at full resolution: 6–11 ms on the real textures, 32–95 ms on the temporary noise.
- Dusk shadow sides are a little brown, and night clouds are a little bright (T8).

**Uniforms per module:**
- density: `uWeather`, `uWeatherOffset`, `uWindVel`, `uTime`, `uShape`, `uDetail`.
- lighting: `uSunDir`, `uSunColor`, `uSunVisible`, `uMoonDir`, `uMoonVisible`, `uMoonFraction`, `uZenith`, `uMid`,
  `uHorizonCol` (and `skyGradient`).
- march: `uCloudType`, `uDebug`, `uBlue` and `uFrame` (through `blueNoise`).
- Unused: `uPrecip` and `uCoverage` (map channels instead).

**Notes for the next task:**
- M1 removes `VOL_TEMP_NOISE`. The exact lines are in `handoffs/T4.md`.
- T5: transmittance hides the sun, and `applyAerial` calls `skyGradient`.
- T7: reproject with `gCloudDist`.
- Requests for M1: emit `VOL_MIN_TRANSMITTANCE`, and decide on `uPrecip` and `uCoverage`.
<!-- /T4 -->

<!-- T5 -->
### T5: sun, moon and stars behind the clouds

**Status:** done (2026-11-27, `vol/T5-background`). The e2e check skips, with the reason, until M1 merges T2 and
removes `VOL_TEMP_NOISE`.

**Done when:**
- The sun (limb darkening, bloom at 3 radii), the moon (phase, terminator, earthshine, glow) and the seeded,
  twinkling stars match the look of `bodies.ts` and `particles.ts`.
- The gradient is dithered.
- `final = cloud.rgb + cloud.a × background`.
- `forcedCellFor` (in `sun-cell.ts`) handles `cover` and `edge`.
- `tests/e2e/lab-cloud-at-sun.spec.ts` passes: the disc centre loses at least 85% of its brightness.
- Screenshots in `.shots/volumetric-lab/T5-*.png`: B with and without `cloudAtSun`, and 20:30 with the moon.

**Files:**
- `background.glsl.ts`:
  - The gradient, with the horizon glow and a blue-noise dither (in `background()` only).
  - Stars: a cube-mapped field seeded per day that twinkles and turns with the sun's hour angle.
  - The moon: a sphere lit from the sun's side, with `uMoonFraction`, earthshine and glow.
  - The sun: a limb-darkened disc with three blooms.
- `sun-cell.ts`: `forcedCellFor`, with the cell on the sun's (or the moon's) ray at 2.2 km, 5–8 km in radius, and
  `edge` shifted 0.4 radii sideways.
- Tests: `tests/unit/vol-sun-cell.test.ts` and `tests/e2e/lab-cloud-at-sun.spec.ts`.
- `renderer.ts` is unchanged: T0 already calls `forcedCellFor`.

**How to verify:**
- `pnpm vitest run tests/unit/vol-sun-cell.test.ts tests/unit/vol-assembly.test.ts`
- `pnpm build:e2e && pnpm e2e:only tests/e2e/lab-cloud-at-sun.spec.ts`. It asks for the GPU, and skips until T2 and
  M1 are in.
- Shots: `.shots/volumetric-lab/T5-{B,B-edge,B-cover,A,A-edge,A-cover,night,night-cover,night-clear,sun-clear-1100,sun-clear-1645}.png`
  and `T5-sheet.png`.
- Disc centre with cloudAtSun 0 → 1, in linear luminance: A goes from 1.00 to 0.099 (−90%).

**Notes for the next task:**
- **M1:** once T2 and the `VOL_TEMP_NOISE` removal are in, the cloud-at-sun check runs.
  - With T1 and T2 overlaid and the define off, it was run with GPU args. Result: it passed in 1.0 s, with the disc at −90%.
  - `lab-smoke` (T0) times out in `locator.screenshot` on the e2e build. Playwright's default Chromium uses software
    GL, on which the march takes seconds per frame. It needs GPU args, as `lab-cloud-at-sun` has, or T7's cost
    cuts.
- **B can't show the sun.** B's 3.4° sun is hidden by the horizon cloud band whatever `cloudAtSun` says. See the
  hand-off's request: a forced clear gap.
- **T7:** draw `background()` in the full-resolution composite.
- **T8:** the tunables are `BACKGROUND_*` and `SUN_CELL`.
<!-- /T5 -->

<!-- T6 -->
### T6: lab screenshots and GPU probe

**Status:** done (2026-11-27, `vol/T6-probes`)

**Files:**
- `scripts/probe/lab-shots.mts`: states A–C (from `LAB_PRESETS`) × tiers high/medium/low × 1440×900 DPR 2 and
  375×812 DPR 3, plus two frames of A 10 s apart, into `.shots/volumetric-lab/run-<ts>/`, with a `sheet.png`
  contact sheet (an HTML grid screenshotted by Playwright).
- `scripts/probe/lab-gpu.mts`: GPU ms/frame per state × tier at 1920×1080 DPR 2 and 375×812 DPR 3, 5 s per cell,
  from `window.__vol` (the renderer's per-frame EXT_disjoint_timer_query_webgl2 query); prints a table with the
  §5 targets marked `OVER` and writes `<run>/gpu.json` (`RUN_DIR` files it beside a shots run).
- `package.json`: `lab:shots`, `lab:gpu`. `docs/volumetric/BRIEF.md`: §11 "Tools" (appended).

**How to verify:**
- With the dev server up (`WEATHER_MOCK=1 CHAT_MOCK=1 NEXT_DIST_DIR=.next-dev pnpm dev -p 3005`):
  `pnpm lab:shots && RUN_DIR=$(ls -td .shots/volumetric-lab/run-* | head -1) pnpm lab:gpu`.
- Full run against the T1–T5 code: `.shots/volumetric-lab/run-20261127-072009/` (20 shots, sheet.png, gpu.json).

**Notes for the next task:**
- Pre-T7 numbers are far over the §5 targets (100–400 ms desktop, 33–124 ms mobile) on the real GPU (verified
  ANGLE Metal, Apple M2) — expected: the placeholder pipeline marches at full resolution every frame. `OVER`
  marks the two target cells.
- In several cells `gpuMs` exceeds `rafMs`; the timer-query semantics are T7's to interpret before trusting the
  absolute values (see the hand-off).
- Details and the tsx `__name` pitfall for `page.evaluate`: `handoffs/T6.md`.
<!-- /T6 -->

<!-- M1 -->
### M1: review of T1–T6

**Status:** done (2026-11-27, `feat/volumetric-lab`). No follow-up blocks T7. **T3 was never delivered** (no branch
exists): see F1.

**Merged** (each with `--no-ff`; gates green after each):
- `vol/T1-noise`
- `vol/T2-weather-map`
- `vol/T4-core`
- T5's commit `20df856` (the `vol/T5-background` ref was stale)
- `vol/T6-probes`

**Fixed:**
- `VOL_TEMP_NOISE` removed. `weatherAt` uses `textureLod`.
- `VOL_MIN_TRANSMITTANCE` define (T4).
- Probes: `load` instead of `networkidle`, and a tier-mismatch flag (T6).
- `types.ts` documents the mip chains (T1).
- `.next-dev` ignored by git, ESLint and tsc (T1, T6).

**How to verify:**
- Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm check:bundle`.
- e2e: `pnpm build:e2e && pnpm e2e:only tests/e2e/lab-cloud-at-sun.spec.ts tests/e2e/lab-smoke.spec.ts` (both pass;
  cloud-at-sun no longer skips).
- Shots: `.shots/volumetric-lab/run-20261127-074508/` (20 shots, `sheet.png`). GPU table: `…/gpu.json`.

**GPU after M1** (mean ms, ANGLE Metal on an M2, full-resolution march):

| Viewport | Tier | A | B | C |
| --- | --- | --- | --- | --- |
| 1920×1080 DPR 2 | high | 58.4 | 55.9 | 35.6 |
| 1920×1080 DPR 2 | medium | 39.2 | 38.0 | 25.4 |
| 1920×1080 DPR 2 | low | 27.5 | 26.4 | 20.2 |
| 375×812 DPR 3 | high | 21.1 | 19.7 | 12.4 |
| 375×812 DPR 3 | medium | 14.7 | 13.7 | 10.0 |
| 375×812 DPR 3 | low | 10.7 | 10.1 | 9.4 |

All four target cells are OVER (high ≤ 2.5, low ≤ 3). That's T7's job. On the temp noise it was 102–412 ms.

**Follow-ups** (detail in `handoffs/M1.md`):

| ID | Owner | Blocks | Task |
| --- | --- | --- | --- |
| F1 | GLM (T3) | T8 | Deliver T3 as specified: the controls panel, clamping, `vol-lab-state` tests; accept `cloudAtSun=cover` |
| F2 | Claude Code (T8) | sign-off | B: the `edge` cell reads as a flat slab on the horizon, and the low sun is always hidden. Add the `forcedCell.clear` gap, shape the cell, extend `lab-cloud-at-sun` to B |
| F3 | Claude Code (T8) | sign-off | C: the overcast deck streaks and swirls toward the horizon (the rejected look). Needs cellular texture with no smear |
| F4 | GLM | nothing | `scripts/probe/lab-noise.mts`: GPU-vs-CPU noise readback probe |

**Notes for T7:**
- `gpuMs` > `rafMs` in heavy cells: check the timer semantics.
- `WeatherMap.offset` wraps, so reproject with `velocity`.
- The forced cell regenerates the map once a second (~1.5 ms).
- Draw `background()` at full resolution.
<!-- /M1 -->

<!-- T7 -->
### T7: performance

**Done when:**
- Clouds render to an RGBA16F target at the tier scale.
- 2×2 checkerboard reprojection with α 0.25 and a neighbourhood clamp.
- Re-march at ≤ 15 Hz, with a bilateral upsample.
- Automatic tiers step down after 20 ms for 3 s, and the change is logged.
- `pnpm lab:gpu`: high ≤ 2.5 ms (1920×1080 DPR 2) and low ≤ 3 ms (375×812 DPR 3), with a before/after table.
- Two frames 10 s apart show no ghosting.

**Status:** partial (2026-11-27, `vol/T7-perf`). Everything is built. The mobile target is met. The desktop high target
is **OVER** (4.3–4.5 ms against ≤ 2.5), and closing it needs an owner decision (`handoffs/T7.md`, "Why desktop high
is still OVER").

**Files:**
- `targets.ts`: the passes, in order:
  - march: a quarter of the pixels, Bayer 2×2, into RGBA32F with the distance packed into the alpha.
  - resolve: into the RGBA16F cloud target at the tier scale, with wind reprojection, the 3×3 clamp and α 0.25.
  - full-resolution background caches, every 4th march.
  - the full-resolution composite, every frame.
  - Plus the ≤ 15 Hz march clock and `invalidate()`.
- `reproject.glsl.ts`: `cloudsAt` (bilateral only at transmittance edges, and the wind shift since the last resolve),
  the resolve, velocity and composite helpers, and the `REPROJECT_*` tunables.
- `tiers.ts`: `auto` starts high, or medium on a coarse pointer, and steps down when the median rAF interval is over
  20 ms for 3 s (logged).
- `renderer.ts` (wiring):
  - The governor gets the rAF interval.
  - `setState` calls `invalidate()`.
  - `__vol.gpuMs` = the mean of the last 60 measured frames (it was one frame, which aliased with the 15 Hz march in
    `lab:gpu`).
- `tests/unit/vol-tiers.test.ts`: 19 tests.

**GPU, before → after** (`pnpm lab:gpu`, mean ms, ANGLE Metal on an M2):

| Viewport | Tier | A | B | C |
| --- | --- | --- | --- | --- |
| 1920×1080 DPR 2 | high | 58.75 → **4.45** | 56.99 → **4.37** | 36.73 → **4.26** |
| 1920×1080 DPR 2 | medium | 40.19 → 4.15 | 38.92 → 3.85 | 26.22 → 3.63 |
| 1920×1080 DPR 2 | low | 28.31 → 3.53 | 26.96 → 3.46 | 20.64 → 3.83 |
| 375×812 DPR 3 | high | 20.48 → 2.15 | 18.65 → 2.01 | 12.62 → 1.64 |
| 375×812 DPR 3 | medium | 14.21 → 1.94 | 12.80 → 1.71 | 9.58 → 1.37 |
| 375×812 DPR 3 | low | 10.80 → **1.40** | 9.73 → **1.43** | 8.95 → **1.24** |

- High ≤ 2.5: OVER.
- Low ≤ 3: met.
- The desktop floor is a full-resolution pass at 3840×2160: 0.83 ms writing a constant, 1.2–1.6 ms copying a cache.

**How to verify:**
- Gates; `pnpm vitest run tests/unit/vol-tiers.test.ts`.
- e2e: `pnpm build:e2e && pnpm e2e:only tests/e2e/lab-cloud-at-sun.spec.ts tests/e2e/lab-smoke.spec.ts`. 2 passed.
- With the dev server on :3005: `pnpm lab:shots && RUN_DIR=$(ls -td .shots/volumetric-lab/run-* | head -1) pnpm lab:gpu`.
  - Final run: `.shots/volumetric-lab/run-20261127-090543/`. Before: `.shots/volumetric-lab/T7-before/gpu.json`.
  - Ghosting: `A-drift-0s.png` vs `A-drift-10s.png`. No trails, no smear, and no stripes on thin cloud.

**Notes for the next task:**
- **T8:**
  - The `REPROJECT_*` constants, `HISTORY_ALPHA`, `MARCH_HZ` (≤ 15) and `BG_EVERY` are tunable.
  - At 0.35 scale, edges are softer than the old full-res march. Judge checklist item 2 with that in mind.
  - `reprojectWorldVelocity` uses `DENSITY_DETAIL_DRIFT`.
- **T3:** every `setState` resets the history (four marches), so throttle drags to one call per frame.
- **M1:**
  - Requests: `CloudPipeline.invalidate`, the `VolDebug.gpuMs` doc, and, optionally, an `outColor` location and
    `textureGather` in the assembly test.
  - The desktop target needs an owner decision.
<!-- /T7 -->

<!-- T8 -->
### T8: visual tuning, then the owner's review

**Done when:**
- Two review rounds are recorded: PASS/FAIL per checklist item, per state and size, with shot paths.
- Only constants and shaping functions were changed.
- The `pnpm lab:gpu` budgets still hold.
- The hand-off lists the 3 URLs, the contact sheet, the GPU table and an honest list of what still doesn't look real.
- Status `needs-human`; nothing integrated into the home page.

**Status:** needs-human (2026-11-27, `vol/T8-tuning`, branched from `feat/volumetric-lab` after the T7 merge).

**Files:**
- `density.glsl.ts`: the stratus SHAPE tile, its far fade, erosion, the coverage floor and ragged bases.
- `lighting.glsl.ts`: diffuse per type with a neutral tint, ambient, light path, octaves, and the haze with its
  overcast grey.
- `march.glsl.ts`: the per-type detail LOD.
- `background.glsl.ts`: sun gain and blooms.
- `sun-cell.ts`, `weather-map.ts`, and `forcedCell.clear` in `types.ts` (F2).
- `lab-cloud-at-sun.spec.ts`: B.
- `vol-sun-cell.test.ts`: one line.

**Review rounds** (full tables in `handoffs/T8.md`; shots in `.shots/volumetric-lab/T8-r{0,1,2,3}/`; sheet
`T8-r3/sheet.png`). Final round, A / B / C at 1440 and 375, all tiers alike:

| # | Item | A | B | C |
| --- | --- | --- | --- | --- |
| 1 | Sunlit tops, darker bases | PASS | PASS | – |
| 2 | Detailed edges, no smear | FAIL (soft at 0.35 scale) | PASS | FAIL (soft streaks overhead) |
| 3 | Shrink to horizon, no banding | PASS | PASS | PASS (faint spokes at full res) |
| 4 | Warm undersides, silver lining (B) | – | PASS | – |
| 5 | Sun hidden / bleeds through | PASS (e2e, cloudAtSun=1) | PASS (e2e + shots) | – |
| 6 | Overcast deck, no tiling (C) | – | – | PASS |
| 7 | Mobile equally real | PASS | PASS | PASS |

**GPU** (`T8-r3/gpu.json`):
- Desktop high: 4.42–4.70 ms, still OVER 2.5, as after T7.
- Mobile low: 1.38–1.50 ms, which meets its ≤ 3 target.

**How to verify:**
- Gates; then `pnpm build:e2e && E2E_PORT=3111 pnpm e2e:only tests/e2e/lab-cloud-at-sun.spec.ts tests/e2e/lab-smoke.spec.ts`.
- `pnpm lab:shots` / `pnpm lab:gpu` with `LAB_URL` pointing at a lab dev server.

**Notes for the owner:**
- Review the three URLs in `handoffs/T8.md`.
- Open decisions: the desktop GPU target (T7), A's soft edges at the 0.35 scale, and the cloudAtSun=edge staging
  wedge.
- T1 should switch the noise to mipmapped filtering, which would clear C's last spokes.
<!-- /T8 -->

<!-- T10 -->
### T10: realism (LOD, scattering, aureole)

**Status:** partial (2026-11-27, `vol/T10-realism`, from `feat/volumetric-lab` at the T8 merge; T9 had no commits, so
the review params sit behind `// TEMP until T9` in `renderer.ts`).

**Files:**
- `density.glsl.ts`: footprint LOD for SHAPE and DETAIL; DETAIL fades to its mean by LOD 2 → 4; σt 66 km⁻¹ without the
  × coverage; the cumulus edge curve; the 0.32-km DETAIL tile; the wispy-to-billowy blend over height 0.05–0.5.
- `lighting.glsl.ts`: octaves 0.5 / 0.35 / 0.5; the 40 m × 2 light march (detail on every step but the last, which
  reads SHAPE at LOD + 2); AO from +100 m and +400 m; cumulus diffuse 0.5.
- `march.glsl.ts`: the fixed-km detail fades are gone.
- `background.glsl.ts`: the Cornette–Shanks aureole (sun and moon) in `skyGradient`.
- `noise-gpu.ts`: `LINEAR_MIPMAP_LINEAR` (filtering only).
- `renderer.ts`: `applyReviewParams` only (`scale`, `reproject=0`, `accum=N`, `az`).

**Diagnosis:**
- A-ref (scale 1, reproject=0, accum=64) matched A-high: bodyStd 12.2 vs 12.4, edge 19.6 vs 19.9 px. The softness was in
  density and lighting.
- The horizon slices persist in A-ref, so they were in the field.
- Nothing is handed to T11 for the pipeline.

**Results:** the full tables are in `handoffs/T10.md`; shots in `.shots/volumetric-lab/T10-r0` (baseline) to `T10-r4`
(final), each with `metrics.json`, `crops.png` and `pair-A.png`.

**Open (owner):**
- `lab-cloud-at-sun.spec.ts` **fails on the e2e build**: A's clear precondition reads 0.551 against > 0.6, the same on every run (B and smoke pass). It also fails on medium and high:
  - A's cover check reads luminance, and with the new scattering a covered sun's cloud glows. T shows ≥ 99% of the disc
    hidden.
  - A's ordinary field now has a cumulus over the sun.
  - B's edge shift (`sun-cell.ts`) fully covers the disc on medium and high.
- See hand-off Requests 1–2 and DECISIONS #204.

**Notes for T11 (desktop GPU):**
- T10 adds detail to light-march steps 2–4 and two AO density samples per lit sample.
- Measured, same day and machine: desktop high A +0.50, B −0.22, C +0.96 ms (mobile low ≤ +0.27, 1.27–1.44 ms). C pays the most, because almost every
  sample of a 95% deck is lit cloud.
- Cheaper AO (shape only, or one sample) is the first lever. It costs some lobe contrast in backlit bodies.
<!-- /T10 -->
