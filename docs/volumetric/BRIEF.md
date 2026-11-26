# Volumetric clouds lab: the brief

Every session on this project reads this file first, then `TASKS.md`, `plan.json` and the hand-offs of its
dependencies (`handoffs/<id>.md`). It is the single source of context. The repo's `CLAUDE.md` still applies in full.

## 1. Why

The owner rejected both earlier attempts at the home page's clouds:

- **The noise sheets** (Weather v6, W1/W2): smeared, marble swirls and banding toward the horizon.
- **The flat paper-cut puffs** (2026-11-27): clip-art.

The target is **photographic realism in every state**, with the sun, moon and stars genuinely **behind** the clouds:
covered where a cloud is thick, glowing through where it is thin. The clouds are built in an isolated lab page first.
**Nothing touches the home page sky until the owner signs off on the lab (after T8).**

## 2. Technique

Real-time volumetric clouds, ray-marched through a spherical shell, after:

- A. Schneider, N. Vos: *The Real-Time Volumetric Cloudscapes of Horizon Zero Dawn* (SIGGRAPH 2015, Advances in
  Real-Time Rendering).
- A. Schneider: *Nubis: Authoring Real-Time Volumetric Cloudscapes with the Decima Engine* (SIGGRAPH 2017), and
  *Nubis, Evolved* (SIGGRAPH 2022).
- S. Hillaire: *Physically Based Sky, Atmosphere and Cloud Rendering in Frostbite* (SIGGRAPH 2016 course), and
  *A Scalable and Production Ready Sky and Atmosphere Rendering Technique* (EGSR 2020).

**Implement from the papers and the maths, never from someone's code.** Do not copy or port code from Shadertoy (its
default licence is CC BY-NC-SA, which this site can't use) or from any source without a permissive licence (MIT, BSD,
Apache, CC0). If a permissive source shaped your code, name it in your hand-off.

## 3. The lab

- **Route:** `/lab/clouds`. It exists in dev and test builds only. A production build returns 404 unless it was
  built with `NEXT_PUBLIC_SKY_DEBUG=1`. The gate is `src/lib/sky/volumetric/gate.ts`: a module constant the build
  folds (DECISIONS #120), plus a pure `labEnabled()` the tests cover.
- **The page:** a full-viewport canvas, no site chrome (the header is hidden by `globals.css`, and `SkyMount` doesn't
  load the home renderer on `/lab/`), a debug overlay and a controls panel (T3).
- **Hooks for tests and probes:** `window.__vol` (`VolDebug` in `types.ts`): frames, ready, tier, gpuMs, the last 120
  frame times, the state, the noise generation ms and any error.
- **URL state:** every field of `LabState` (`types.ts`) is a URL parameter of the same name. For example:
  `/lab/clouds?t=11:00&cov=0.38&type=cumulus&wind=15&from=270&tier=high&sunAz=&sunEl=&cloudAtSun=0&debug=`

| Param | Values | Default | Meaning |
| --- | --- | --- | --- |
| `date` | `YYYY-MM-DD` | 2026-12-15 | The Dhaka calendar day |
| `t` | `HH:MM` | 11:00 | Dhaka wall clock. Sun and moon come from `src/lib/sky/astro.ts` |
| `cov` | 0..1 | 0.38 | Coverage |
| `type` | stratus, cumulus, cumulonimbus | cumulus | Cloud type |
| `wind` | 0..60 | 15 | km/h |
| `from` | 0..359 | 270 | The bearing the wind blows from (270 means clouds move east) |
| `precip` | 0..1 | 0 | Precipitation |
| `tier` | high, medium, low, auto | high | Quality tier (`TIERS`) |
| `sunAz`, `sunEl` | degrees or empty | empty | Sun override. Empty means the real sun |
| `cloudAtSun` | 0, 1, edge | 0 | A forced cell over the sun (the moon at night): `1` covers it, `edge` puts the cell's edge on it |
| `freeze` | 0, 1 | 0 | Stops the animation clock (wind scroll, detail evolution) |
| `seed` | integer | 1 | Weather-map seed |
| `view` | degrees or empty | empty | Camera azimuth. Empty faces the sun (the moon at night, else south) |
| `debug` | empty, a JS view, or a shader view | empty | `registerDebugView` names, or `SHADER_DEBUG_VIEWS` (weather, density, transmittance, light, depth) |

## 4. Conventions

- **Units:** km for distances. Degrees in TypeScript, radians in GLSL. Colours are linear RGB in the shaders and in
  the uniforms. `displayColor()` (common) does exposure, a soft shoulder and the sRGB encoding at the very end.
- **World axes:** +x east, +y up, +z north. The camera is at `(0, CAMERA_ALT, 0)`. The planet's centre is
  `(0, −EARTH_R, 0)`. A bearing `az` and an elevation `el` give the direction
  `(sin az · cos el, sin el, cos az · cos el)` (`dirFromAzEl` in `scene.ts`).
- **Weather map:** shaders sample it at `uv = world.xz / WEATHER_MAP_KM − uWeatherOffset`. `offset` grows in the
  direction the clouds move (u east, v north). A map feature at uv `c` sits over world
  `xz = WEATHER_MAP_KM · (c + offset)`.
- **Hex:** none in this project's code. Colours come from `src/lib/sky/palette.ts` and `gradient.ts` through
  `scene.ts` and the uniforms. GLSL float constants (`vec3(1.0, 0.96, 0.9)`) are allowed. A new palette colour is a
  "Request for M1".
- **Copy:** the lab is a developer tool, not site copy, so its labels stay in the controls. Keep each string literal
  under 40 characters (`tests/unit/copy-scan.test.ts`). Never put lab strings in `src/content.ts`, because that file
  feeds the agent's knowledge.
- **No new dependencies.** No Three.js, no glslify, no noise libraries.

## 5. Renderer spec

**Noise (T1).** Generate the noise on the GPU at startup into 3D textures, once per session (and again on a tier
change).

- **SHAPE:** 64³ (128³ on the high tier), RGBA8. R is Perlin-Worley (Perlin fbm remapped by inverted Worley). GBA are
  inverted Worley fbm at three rising frequencies.
- **DETAIL:** 32³, RGB inverted Worley fbm at three frequencies.
- Every channel tiles seamlessly in x, y and z.
- **BLUE:** a 64×64 blue-noise 2D texture (R8, NEAREST, REPEAT).
- Generation must take under 150 ms.

**Weather map (T2).** 2D, 128×128 RGBA8, LINEAR, REPEAT.

- Channels: R coverage. G type (0 stratus, 0.5 cumulus, 1 cumulonimbus). B precipitation.
- It is generated on the CPU from `WeatherMapParams` (deterministic per seed), clustered rather than uniform, and
  scrolled with the wind (`offset`, `velocity`).
- The wind is time-lapsed (`WIND_TIMELAPSE`, T2 documents it) so drift is visible.

**Geometry (T4).**

- The camera is at ground level.
- The cloud shell is spherical: earth radius 6,360 km, base 1.5 km, top 4 km. Cumulonimbus reaches 10 km.
- Vertical FOV is 60°, with the horizon at 82% of the viewport height from the top. `scene.ts` pitches the camera to
  do this; `viewRay(uv)` returns the ray.
- March between the shell intersections. Clamp the march to `MAX_MARCH` (60 km) and grow the step with distance
  (near-horizon rays are long).
- Jitter the start with blue noise (`blueNoise(gl_FragCoord.xy)`).
- Exit early at transmittance < 0.01.
- Steps: high 64, medium 40, low 24 (`VOL_STEPS`). Light-march steps: 6 (`VOL_LIGHT_STEPS`).

**Density (T4).**

- SHAPE is remapped by a per-type height gradient:
  - stratus: thin and flat
  - cumulus: rounded, with a flat base
  - cumulonimbus: tall, with an anvil spreading at the top
- It is eroded by DETAIL at low density and at the edges (the standard remap), then multiplied by the weather map's
  coverage.
- DETAIL evolves slowly with `uTime`.
- Precipitation darkens the base (the hook stays for later).

**Lighting (T4).**

- Beer–Lambert with the powder term.
- Dual-lobe Henyey–Greenstein (g 0.8 and −0.2, mixed 0.5). The silver lining comes from the forward lobe.
- Ambient from the gradient: zenith colour on the tops, horizon colour on the bases, by height fraction.
- Sun colour by elevation (`uSunColor`, from `gradient.ts sunColor`). Moonlight at night (`uMoonDir`, `uMoonFraction`).
- Aerial perspective toward the horizon colour by distance.
- Output: premultiplied colour, plus transmittance.

**Background (T5), in the same pass, before the clouds.**

- The sky gradient (`gradient.ts` through `uZenith`, `uMid` and `uHorizonCol`), dithered with blue noise so it doesn't
  band.
- Stars: seeded per day, twinkling, hidden by day (`uStarAlpha`).
- The moon: phase-correct, from the existing astro inputs, with terminator, earthshine and a soft glow.
- The sun: limb darkening, bloom at three radii, colour by elevation.
- Port the look of `src/components/sky/bodies.ts` and `particles.ts`.
- Clouds composite over all of this with their transmittance: `final = cloud.rgb + cloud.a × background`.

**Performance (T7).**

- Clouds render into an RGBA16F target at 0.35 / 0.3 / 0.25 × the drawing buffer (high / medium / low).
- 2×2 checkerboard temporal reprojection: one pixel of each 2×2 block per frame, history reprojected with the wind
  velocity, α 0.25, and a neighbourhood clamp against ghosting.
- Re-march at most 15 Hz. Bilateral upsample (4 taps, weighted by the transmittance difference). Composite every
  frame.
- Automatic tiers: high on a fine pointer, medium on a coarse one. Step down when the median frame time is over 20 ms
  for 3 s.
- **Targets:** high ≤ 2.5 ms of GPU at 1920×1080 DPR 2. Low ≤ 3 ms at 375×812 DPR 3. Measure with `pnpm lab:gpu`
  (T6).

## 6. Architecture: how the pieces plug together

```
src/app/lab/clouds/page.tsx        T0  server page: the gate, metadata (noindex)
src/app/lab/clouds/LabClient.tsx   T0  canvas + overlay; parseLabState → startRenderer → <Controls>
src/app/lab/clouds/controls/**     T3  the panel; calls renderer.setState and history.replaceState
src/components/sky/volumetric/
  types.ts         T0  THE CONTRACT: every type, constant, uniform and GLSL function signature
  renderer.ts      T0  context, tier, noise, weather map, uniforms, timer query, frame loop, hook API
  assemble.ts      T0  header (+ #defines + uniforms) + modules in order + a pass's main
  debug-views.ts   T0  registerDebugView registry (?debug=<name>)
  common.glsl.ts   T0  viewRay, blueNoise, raySphere, remap, displayColor, gCloudDist
  background.glsl.ts  T5   density.glsl.ts / lighting.glsl.ts / march.glsl.ts  T4
  reproject.glsl.ts, targets.ts, tiers.ts  T7      noise-gpu.ts  T1
src/lib/sky/volumetric/
  scene.ts   T0  LabState → sun, moon, sky colours, stars, camera, weather params (pure)
  gate.ts    T0  labEnabled / LAB_ENABLED
  lab-state.ts T3   weather-map.ts T2   noise/** T1   sun-cell.ts T5
```

**A frame** (`renderer.ts`):

1. Advance the clock (unless frozen).
2. `weather.update(dt)`. Once a second, `weather.setParams` with `forcedCellFor(...)` (T5).
3. `sceneFor(state)` → `CloudUniforms`.
4. Begin the GPU timer query.
5. Either a registered debug view's `draw(ctx)`, or `pipeline.render(ctx)` (T7's `targets.ts`).
6. End the query, then notify `onFrameTime` listeners and the tier governor.

**Shaders.**

- There is one assembly for every pass: `header(tier)` + `common` → `background` → `density` → `lighting` →
  `march` → `reproject` + the pass's `main`.
- The header declares every `CLOUD_UNIFORMS` name and the `VOL_*` defines (`GEOMETRY`, tier steps and sizes).
- Modules never declare those uniforms. A module's own uniforms (T7's history textures) use its own prefix (`uRp…`).
- A module may call only functions from modules earlier in the order. It defines exactly its contract functions
  (`GLSL_CONTRACT`), and every helper it adds starts with the module's name (`densityRemap`, `marchStep`, …).
- `tests/unit/vol-assembly.test.ts` enforces all of this.
- `PassContext.program(key, main)` compiles and caches. `apply(p, overrides)` sets every uniform and binds the
  textures (units: `TEXTURE_UNITS`; T7 uses 4 and up). `fullscreen()` draws the triangle.
- A compile error prints the numbered assembled source to the console and sets `window.__vol.error`.

**The hook API** (`VolRenderer`):

- `setState(state)`
- `registerDebugView(name, view)` (also importable from `debug-views.ts`, so a task registers its view from its own
  file)
- `onFrameTime(cb)`, returning the unsubscribe; each call receives `{ gpuMs, cpuMs, rafMs, tier }`
- `tier`, `gl` and `dispose()`

## 7. Acceptance

The three states:

| | URL | What it shows |
| --- | --- | --- |
| **A** | `/lab/clouds?t=11:00&type=cumulus&cov=0.38&wind=15&from=270` | Late-morning fair-weather cumulus |
| **B** | `/lab/clouds?t=16:45&type=cumulus&cov=0.4&wind=10&from=300&cloudAtSun=edge` | Low sun, partly behind a cloud edge |
| **C** | `/lab/clouds?t=13:00&type=stratus&cov=0.95&wind=15&from=270` | Overcast deck |

(`LAB_PRESETS` in `types.ts`. Date 2026-12-15, seed 1.)

**Checklist.** Each item is judged PASS or FAIL per state, at 1440×900 and at 375×812, on every tier:

1. Sunlit tops and darker bases.
2. Detailed edges with no smear.
3. Clouds shrink toward the horizon, with no banding.
4. Warm undersides and a silver lining at dusk (B).
5. The sun is hidden where it is covered, and light bleeds through thin edges (B, and `cloudAtSun=1`, where the
   disc's centre loses at least 85%).
6. Overcast is a continuous, textured deck with no visible tiling (C).
7. Mobile looks equally real.

Plus the GPU targets in §5.

## 8. Ownership

- `plan.json` `owns` is the source of truth (globs per task). The conductor rejects a task whose commit touches
  anything else.
- **Never edit another task's files.** If you need an interface change (a type, a uniform, a contract function, a
  palette colour, something in `renderer.ts`), write it under **"Requests for M1"** in your hand-off and work around
  it in your own files meanwhile.
- `docs/DECISIONS.md` and `docs/PROGRESS.md` are written by T0, M1 and T8 only, because parallel tasks would collide
  there. Every other task records its decisions in its hand-off, and M1 or T8 carries them over.
- Each task owns its own section of `TASKS.md` (between its `<!-- Tn -->` markers) and its hand-off file.

## 9. Workflow (every session is unattended)

1. **Setup.** The conductor prepares your worktree on the branch `vol/<id>-<name>` (from `feat/volumetric-lab`) and
   a dev server at `http://localhost:$VOL_PORT`. If you run a session by hand, create the branch yourself and start a
   dev server: `WEATHER_MOCK=1 CHAT_MOCK=1 NEXT_DIST_DIR=.next-dev pnpm dev -p 3005`, checking the port first.
2. **Read** `CLAUDE.md`, this brief, `TASKS.md`, `plan.json`, and your dependencies' hand-offs.
3. **One task per session.** Implement only the files your task owns.
4. **Screenshots** where your task asks for them, into `.shots/volumetric-lab/`:
   `pnpm exec playwright screenshot --viewport-size=W,H "<url>" <file>` against the running server. Look at them.
   For several shots, make one contact sheet (`npx tsx scripts/probe/sheet.mts out.png <cols> <w> <files…>`) and
   read that.
5. **Update your section of `TASKS.md`** (status, files, how to verify, notes for the next task). **Write
   `handoffs/<id>.md`**, using the template below.
6. **Gates before the commit** (CLAUDE.md): `pnpm typecheck && pnpm lint && pnpm test && pnpm build &&
   pnpm check:bundle`.
7. **Commit** once: `feat(vol): <id> …` (T7 uses `perf(vol)`, M1 uses `chore(vol)`).
8. **Never** push, deploy, merge, create other branches or worktrees, or start or stop servers you didn't start.

**Hand-off template** (`handoffs/<id>.md`):

```
# <id> hand-off
Status: done | partial | blocked | needs-human
## What I built
## Files (each owned file and what it holds)
## How to verify (commands, URLs, shot paths)
## Decisions (for M1/T8 to carry into docs/DECISIONS.md)
## Known issues
## Requests for M1 (interface changes, with the reason)
## Notes for the next task
```

## 10. Rules carried from CLAUDE.md

- No push, no deploy. Never touch `main`.
- Hex only in `palette.ts` and `globals.css`.
- Gates green before every commit.
- No new dependencies without a DECISIONS entry (here: a Request for M1).
- Accessibility beats design: the controls are keyboard-usable and labelled.
- **Do not change the home page sky** (`src/components/sky/*` outside `volumetric/`, and `src/lib/sky/*` outside
  `volumetric/`). The volumetric code may import from the home page's sky code; never the other way round.
- Never call the real Anthropic API, never hit Open-Meteo, never put keys anywhere but `.env.local`.
