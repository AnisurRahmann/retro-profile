/**
 * Volumetric clouds lab: the contract every task codes against (docs/volumetric/BRIEF.md, owner T0).
 * Change it only through "Requests for M1" in a hand-off. Units: km for distances, degrees in the API, radians in GLSL.
 * World axes: +x east, +y up, +z north; the camera sits at the origin, the planet's centre at (0, −EARTH_R, 0).
 */

// ─── Quality tiers ────────────────────────────────────────────────────────────────────────────────────────────────

export type QualityTier = "high" | "medium" | "low";
export const QUALITY_TIERS: readonly QualityTier[] = ["high", "medium", "low"];

export type TierConstants = {
  /** Primary march steps between the shell intersections. */
  steps: number;
  /** Light-march steps toward the sun (or moon). */
  lightSteps: number;
  /** Cloud render target size as a fraction of the drawing buffer (CSS px × DPR). */
  scale: number;
  /** SHAPE noise edge length (texels). */
  shapeSize: 64 | 128;
  /** DETAIL noise edge length (texels). */
  detailSize: 32;
};

export const TIERS: Record<QualityTier, TierConstants> = {
  high: { steps: 64, lightSteps: 6, scale: 0.35, shapeSize: 128, detailSize: 32 },
  medium: { steps: 40, lightSteps: 6, scale: 0.3, shapeSize: 64, detailSize: 32 },
  low: { steps: 24, lightSteps: 6, scale: 0.25, shapeSize: 64, detailSize: 32 },
};

/** Frame-time targets (ms of GPU per frame) the lab must meet (T7 measures them with pnpm lab:gpu). */
export const GPU_TARGETS = {
  high: { width: 1920, height: 1080, dpr: 2, ms: 2.5 },
  low: { width: 375, height: 812, dpr: 3, ms: 3 },
} as const;

// ─── Geometry (emitted into GLSL as #defines by assemble.ts) ─────────────────────────────────────────────────────

export const GEOMETRY = {
  EARTH_R: 6360,
  CLOUD_BASE: 1.5,
  CLOUD_TOP: 4,
  /** Cumulonimbus tops (the shell's outer radius is EARTH_R + CB_TOP; other types stop at CLOUD_TOP). */
  CB_TOP: 10,
  /** Camera height above the ground. */
  CAMERA_ALT: 0.002,
  /** Longest distance a primary ray marches (near-horizon rays cross the shell over hundreds of km). */
  MAX_MARCH: 60,
  /** One weather-map tile spans this many km in x and z (map uv = world xz / WEATHER_MAP_KM − offset). */
  WEATHER_MAP_KM: 40,
  /** Vertical field of view (degrees). */
  FOV_Y: 60,
  /** The horizon sits at this fraction of the viewport height, from the top. */
  HORIZON_AT: 0.82,
} as const;

/** Early exit when the view ray's transmittance falls below this. */
export const MIN_TRANSMITTANCE = 0.01;

// ─── Noise (T1) ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * GPU-generated, tileable noise. SHAPE: shapeSize³ RGBA8, R Perlin-Worley, GBA inverted Worley fbm at 3 rising
 * frequencies. DETAIL: 32³ RGB8 (or RGBA8), inverted Worley fbm at 3 frequencies. BLUE: 64×64 R8 blue noise.
 * All REPEAT; BLUE NEAREST. SHAPE and DETAIL carry full mip chains (periodic 2×2×2 box means) but MIN_FILTER is
 * LINEAR, so texture() reads level 0; use textureLod for a coarser level (far steps, the light march).
 */
export type NoiseTextures = {
  shape: WebGLTexture;
  detail: WebGLTexture;
  blue: WebGLTexture;
  shapeSize: 64 | 128;
  /** Wall time the generation took (ms), for the lab's log (T1: must be < 150). */
  genMs: number;
  dispose(): void;
};
export type CreateNoiseTextures = { (gl: WebGL2RenderingContext, tier: QualityTier): Promise<NoiseTextures> };

// ─── Weather map (T2) ─────────────────────────────────────────────────────────────────────────────────────────────

export type CloudType = "stratus" | "cumulus" | "cumulonimbus";
export const CLOUD_TYPES: readonly CloudType[] = ["stratus", "cumulus", "cumulonimbus"];
/** The weather map's G channel and the uCloudType uniform. */
export const CLOUD_TYPE_VALUE: Record<CloudType, number> = { stratus: 0, cumulus: 0.5, cumulonimbus: 1 };

export const WEATHER_MAP_SIZE = 128;

export type WeatherMapParams = {
  type: CloudType;
  /** 0..1, the map's mean coverage target. */
  coverage: number;
  /** 0..1. */
  precipitation: number;
  windKmh: number;
  /** Meteorological: the bearing the wind blows FROM (270 = from the west, so clouds move east, toward +u). */
  windFromDeg: number;
  seed: number;
  /**
   * A dense cumulus cell (coverage ≥ 0.95, type 0.5) at map uv (u, v), radius in uv; wraps across the edges.
   * `clear` (cloudAtSun=edge, T8): a clear wedge along the body's line of sight through the layer, from map uv
   * (u0, v0) to (u1, v1) with half-width r0 → r1 (uv), cleared before the cell is stamped, so only the cell's edge
   * stands in front of the body.
   */
  forcedCell?: {
    u: number;
    v: number;
    radius: number;
    clear?: { u0: number; v0: number; u1: number; v1: number; r0: number; r1: number };
  };
};

/** 128×128 RGBA8, LINEAR, REPEAT. R coverage, G type, B precipitation, A unused. */
export type WeatherMap = {
  texture: WebGLTexture;
  /**
   * How far the cloud field has moved, in map uv (u = east, v = north); wraps to [0, 1). Shaders sample the map at
   * world xz / WEATHER_MAP_KM − offset, so a growing u moves the clouds east. A map feature at uv c sits over world
   * xz = WEATHER_MAP_KM × (c + offset).
   */
  offset: [number, number];
  /** d(offset)/dt in uv per second of the animation clock (T7 reprojects with it). */
  velocity: [number, number];
  update(dtSec: number): void;
  /** Regenerates the map only if a param changed. */
  setParams(p: WeatherMapParams): void;
  dispose(): void;
};
export type CreateWeatherMap = (gl: WebGL2RenderingContext, p: WeatherMapParams) => WeatherMap;
/** The pure generator (CPU): WEATHER_MAP_SIZE² × 4 bytes, row-major, v = row. */
export type GenerateWeatherMap = (p: WeatherMapParams) => Uint8Array;

// ─── Lab state (T3) ───────────────────────────────────────────────────────────────────────────────────────────────

/** cloudAtSun: off; "cover": a dense cell centred on the sun (or the moon at night); "edge": the cell's edge on it. */
export type CloudAtSun = "off" | "cover" | "edge";

/**
 * Every URL parameter of /lab/clouds. URL keys are the field names; booleans are 0/1; cloudAtSun is 0 | 1 | edge;
 * nullable numbers are empty or absent for null. Times are Asia/Dhaka.
 */
export type LabState = {
  /** Dhaka calendar day, YYYY-MM-DD. */
  date: string;
  /** Dhaka wall clock, HH:MM. */
  t: string;
  /** 0..1. */
  cov: number;
  type: CloudType;
  /** km/h, 0..60. */
  wind: number;
  /** Bearing the wind blows from, 0..359. */
  from: number;
  /** 0..1. */
  precip: number;
  tier: QualityTier | "auto";
  /** Sun override (degrees); both null → the real sun for date + t. */
  sunAz: number | null;
  sunEl: number | null;
  cloudAtSun: CloudAtSun;
  /** Stops the animation clock (wind scroll, detail evolution); the sky's time is always t. */
  freeze: boolean;
  /** Weather-map and star seed. */
  seed: number;
  /** Camera azimuth (bearing, degrees); null → face the sun (the moon at night, else south). */
  view: number | null;
  /** "" or a debug view: a registered JS view (registerDebugView) or one of SHADER_DEBUG_VIEWS. */
  debug: string;
};
export type ParseLabState = (search: string) => LabState;
export type SerialiseLabState = (s: LabState) => string;

/** The acceptance states (BRIEF.md). Fields not given take LAB_DEFAULTS. */
export const LAB_DEFAULTS: LabState = {
  date: "2026-12-15",
  t: "11:00",
  cov: 0.38,
  type: "cumulus",
  wind: 15,
  from: 270,
  precip: 0,
  tier: "high",
  sunAz: null,
  sunEl: null,
  cloudAtSun: "off",
  freeze: false,
  seed: 1,
  view: null,
  debug: "",
};
export const LAB_PRESETS: Record<"A" | "B" | "C", Partial<LabState>> = {
  A: { t: "11:00", type: "cumulus", cov: 0.38, wind: 15, from: 270 },
  B: { t: "16:45", type: "cumulus", cov: 0.4, wind: 10, from: 300, cloudAtSun: "edge" },
  C: { t: "13:00", type: "stratus", cov: 0.95, wind: 15, from: 270 },
};

// ─── Scene (T0, src/lib/sky/volumetric/scene.ts): LabState → the physical inputs ───────────────────────────────────

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export type LabScene = {
  date: Date;
  sun: { azDeg: number; elDeg: number; dir: Vec3; colour: Vec3; visible: number };
  moon: { azDeg: number; elDeg: number; dir: Vec3; fraction: number; phase: number; angle: number; visible: number };
  /** Linear RGB from src/lib/sky/gradient.ts for this sun elevation and weather. */
  sky: { zenith: Vec3; mid: Vec3; horizon: Vec3; ground: Vec3 };
  stars: { alpha: number; seed: number; warm: Vec3; cool: Vec3 };
  camera: { azDeg: number; pitchDeg: number; forward: Vec3; right: Vec3; up: Vec3; tanHalfFov: number };
  weather: WeatherMapParams;
};

// ─── Uniforms (set by renderer.ts every frame, declared once by assemble.ts) ──────────────────────────────────────

export type GlslType = "float" | "int" | "vec2" | "vec3" | "vec4" | "sampler2D" | "sampler3D";

/**
 * Every uniform the march, density, lighting and background modules may read. Colours are linear RGB.
 * Modules never declare these themselves; a module's own uniforms (T7's history textures) use its own prefix.
 */
export const CLOUD_UNIFORMS = {
  // Frame
  /** Size in px of the target being drawn (the pipeline overrides it per pass). */
  uResolution: "vec2",
  /** The drawing buffer (full-resolution canvas) in px. */
  uViewport: "vec2",
  /** Animation clock (s); stops while frozen. */
  uTime: "float",
  uFrame: "int",
  /** Index into SHADER_DEBUG_VIEWS + 1; 0 = off. */
  uDebug: "int",
  uExposure: "float",
  // Camera
  uCamPos: "vec3",
  uCamForward: "vec3",
  uCamRight: "vec3",
  uCamUp: "vec3",
  uTanHalfFov: "float",
  /** Viewport width / height. */
  uAspect: "float",
  // Sun and moon
  uSunDir: "vec3",
  uSunColor: "vec3",
  uSunElev: "float",
  /** 0 below the horizon → 1 above (smooth). */
  uSunVisible: "float",
  uMoonDir: "vec3",
  /** Illuminated fraction 0..1. */
  uMoonFraction: "float",
  /** 0 new → 0.5 full → 1 new. */
  uMoonPhase: "float",
  /** Bright limb's midpoint angle (rad, suncalc). */
  uMoonAngle: "float",
  uMoonVisible: "float",
  // Sky (src/lib/sky/gradient.ts)
  uZenith: "vec3",
  uMid: "vec3",
  uHorizonCol: "vec3",
  /** Below the horizon (the lab has no landscape). */
  uGround: "vec3",
  uStarAlpha: "float",
  uStarSeed: "float",
  uStarWarm: "vec3",
  uStarCool: "vec3",
  // Weather
  uCoverage: "float",
  /** CLOUD_TYPE_VALUE. */
  uCloudType: "float",
  uPrecip: "float",
  /** WeatherMap.offset. */
  uWeatherOffset: "vec2",
  /** WeatherMap.velocity (uv/s). */
  uWindVel: "vec2",
  // Textures (fixed units: TEXTURE_UNITS)
  uShape: "sampler3D",
  uDetail: "sampler3D",
  uBlue: "sampler2D",
  uWeather: "sampler2D",
} as const satisfies Record<string, GlslType>;

type JsValue<T extends GlslType> = T extends "float" | "int" ? number : T extends "vec2" ? Vec2 : T extends "vec3" ? Vec3 : T extends "vec4" ? Vec4 : never;
type ValueUniform = { [K in CloudUniformName]: (typeof CLOUD_UNIFORMS)[K] extends "sampler2D" | "sampler3D" ? never : K }[CloudUniformName];
export type CloudUniformName = keyof typeof CLOUD_UNIFORMS;
/** The values renderer.ts computes each frame (samplers are bound by unit, not set here). */
export type CloudUniforms = { [K in ValueUniform]: JsValue<(typeof CLOUD_UNIFORMS)[K]> };

/** Texture units the renderer binds before every pass. T7's own textures use units ≥ 4. */
export const TEXTURE_UNITS = { uShape: 0, uDetail: 1, uBlue: 2, uWeather: 3 } as const;

/** ?debug=<name> values handled inside the shaders (uDebug = index + 1). JS views use registerDebugView instead. */
export const SHADER_DEBUG_VIEWS = ["weather", "density", "transmittance", "light", "depth"] as const;

// ─── GLSL modules ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Each *.glsl.ts exports one string (`export const <name>Glsl`) that defines exactly the functions listed here, once.
 * assemble.ts concatenates: header (version, precision, #defines from GEOMETRY and the tier, every CLOUD_UNIFORMS
 * declaration) → common → background → density → lighting → march → reproject → the pass's main. A module may call
 * functions of modules before it, plus its own; helpers it adds must be prefixed with the module name
 * (e.g. densityRemap) so nothing collides. No module writes `uniform` for a CLOUD_UNIFORMS name.
 */
export const GLSL_MODULES = ["common", "background", "density", "lighting", "march", "reproject"] as const;
export type GlslModuleName = (typeof GLSL_MODULES)[number];

export const GLSL_CONTRACT: Record<GlslModuleName, { owner: string; file: string; functions: string[] }> = {
  common: {
    owner: "T0",
    file: "src/components/sky/volumetric/common.glsl.ts",
    functions: [
      // The view ray (normalised, world space) for a uv in [0, 1]² of the full viewport (y up).
      "vec3 viewRay(vec2 uv)",
      // Blue noise in [0, 1) for a fragment, decorrelated per frame (golden-ratio offset by uFrame).
      "float blueNoise(vec2 fragCoord)",
      // Ray–sphere intersection with a sphere of radius r centred on the planet: (tNear, tFar), tFar < 0 = miss.
      "vec2 raySphere(vec3 ro, vec3 rd, float r)",
      "float remap(float v, float lo, float hi, float newLo, float newHi)",
      // Linear HDR → display sRGB (exposure, soft shoulder, gamma).
      "vec3 displayColor(vec3 linear)",
    ],
  },
  background: {
    owner: "T5",
    file: "src/components/sky/volumetric/background.glsl.ts",
    functions: [
      // Everything behind the clouds for a view ray: the gradient, stars, moon, sun (linear HDR).
      "vec3 background(vec3 rd)",
      // The gradient alone (lighting uses it for ambient and aerial perspective).
      "vec3 skyGradient(vec3 rd)",
    ],
  },
  density: {
    owner: "T4",
    file: "src/components/sky/volumetric/density.glsl.ts",
    functions: [
      // Extinction density (per km) at world point p; lod 0 = full detail, 1 = shape only (light march, far steps).
      "float cloudDensity(vec3 p, float lod)",
      // 0 at the cloud base → 1 at the type's top, for p.
      "float heightFraction(vec3 p)",
      // The weather map at p: (coverage, type, precipitation).
      "vec3 weatherAt(vec3 p)",
    ],
  },
  lighting: {
    owner: "T4",
    file: "src/components/sky/volumetric/lighting.glsl.ts",
    functions: [
      // Dual-lobe Henyey–Greenstein for the angle between the view ray and the light.
      "float cloudPhase(float cosTheta)",
      // Radiance scattered toward the eye per unit extinction at p (sun with the 6-step light march + powder, moon, ambient).
      "vec3 cloudRadiance(vec3 p, vec3 rd, float density)",
      // Aerial perspective on a cloud result (premultiplied rgb, transmittance) at mean distance dist (km).
      "vec4 applyAerial(vec4 cloud, vec3 rd, float dist)",
    ],
  },
  march: {
    owner: "T4",
    file: "src/components/sky/volumetric/march.glsl.ts",
    functions: [
      // Clouds along a view ray: rgb = premultiplied linear radiance, a = transmittance (1 = clear). Also writes
      // gCloudDist (the transmittance-weighted mean distance in km, 0 if nothing was hit), which T7 reprojects with.
      "vec4 marchClouds(vec3 ro, vec3 rd)",
    ],
  },
  reproject: {
    owner: "T7",
    file: "src/components/sky/volumetric/reproject.glsl.ts",
    functions: [
      // The cloud layer (premultiplied rgb, transmittance) at a full-viewport uv, upsampled from the cloud target.
      "vec4 cloudsAt(vec2 uv)",
    ],
  },
};

/** Globals a module defines (not functions): name → the defining module. */
export const GLSL_GLOBALS: Record<string, GlslModuleName> = { gCloudDist: "common" };

// ─── Pipeline (T7, targets.ts): who draws what each frame ─────────────────────────────────────────────────────────

export type FrameInfo = {
  /** performance.now() of this frame. */
  nowMs: number;
  /** Seconds since the last frame (0 while frozen). */
  dt: number;
  /** The animation clock (uTime). */
  time: number;
  index: number;
};

export type PassContext = {
  gl: WebGL2RenderingContext;
  tier: QualityTier;
  /** The drawing buffer in px. */
  width: number;
  height: number;
  frame: FrameInfo;
  weather: WeatherMap;
  /** Assembles header + every module + main (a GLSL `void main()` writing `out vec4 outColor`) and compiles; cached by key. */
  program(key: string, main: string): WebGLProgram;
  /** useProgram(p), then sets every CLOUD_UNIFORMS value (with overrides) and binds TEXTURE_UNITS. */
  apply(p: WebGLProgram, overrides?: Partial<CloudUniforms>): void;
  /** Draws the full-screen triangle into the bound framebuffer (set the viewport yourself). */
  fullscreen(): void;
};

export type CloudPipeline = {
  render(ctx: PassContext): void;
  /** The drawing buffer changed size (also called once before the first render). */
  resize(width: number, height: number): void;
  dispose(): void;
};
export type CreatePipeline = (gl: WebGL2RenderingContext, tier: QualityTier) => CloudPipeline;

// ─── Tiers (T7, tiers.ts) ─────────────────────────────────────────────────────────────────────────────────────────

export type ResolveTier = (requested: QualityTier | "auto", env: { coarsePointer: boolean }) => QualityTier;
/** Watches frame times; returns a lower tier once it should step down, else null. */
export type TierGovernor = { sample(frameMs: number, nowMs: number): QualityTier | null };
export type CreateTierGovernor = (start: QualityTier, enabled: boolean) => TierGovernor;

// ─── Renderer hook API (T0, renderer.ts) ──────────────────────────────────────────────────────────────────────────

export type FrameTime = {
  /** GPU ms of the last measured frame (EXT_disjoint_timer_query_webgl2), null when unavailable. */
  gpuMs: number | null;
  /** JS ms spent building and submitting the frame. */
  cpuMs: number;
  /** ms between this rAF and the previous one. */
  rafMs: number;
  tier: QualityTier;
};

export type DebugContext = {
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  frame: FrameInfo;
  noise: NoiseTextures;
  weather: WeatherMap;
  /** As PassContext.program (the header and modules are available to a debug main). */
  program(key: string, main: string): WebGLProgram;
  apply(p: WebGLProgram, overrides?: Partial<CloudUniforms>): void;
  fullscreen(): void;
};

/** A JS debug view, shown instead of the pipeline while ?debug=<name>. mount() gets an overlay element for its UI. */
export type DebugView = {
  draw(ctx: DebugContext): void;
  mount?(host: HTMLElement): () => void;
};

export type VolRenderer = {
  readonly gl: WebGL2RenderingContext;
  readonly tier: QualityTier;
  setState(s: LabState): void;
  registerDebugView(name: string, view: DebugView | ((ctx: DebugContext) => void)): void;
  /** Calls back after every frame; returns the unsubscribe. */
  onFrameTime(cb: (t: FrameTime) => void): () => void;
  dispose(): void;
};

/** window.__vol in dev and test builds: what the e2e tests and probes read. */
export type VolDebug = {
  frames: number;
  ready: boolean;
  tier: QualityTier;
  gpuMs: number | null;
  /** The last 120 frame times. */
  times: FrameTime[];
  state: LabState;
  noiseMs: number;
  error: string | null;
};

declare global {
  interface Window {
    __vol?: VolDebug;
  }
}
