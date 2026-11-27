/**
 * The frame's passes (owner T7). Contract: CreatePipeline in types.ts; the GLSL side is reproject.glsl.ts.
 *
 * At most MARCH_HZ times a second (time-based, on the real clock):
 *   1. march      a quarter of the cloud target (one pixel per 2×2 block, Bayer order) → `march` (RGBA32F, packed)
 *   2. resolve    the previous cloud target, reprojected with the wind and clamped, + the fresh samples → the next
 *                 one (RGBA16F at TIERS[tier].scale × the drawing buffer; ping-pong)
 *   3. background on every BG_EVERY-th march, the full-resolution caches: background(rd) (RGBA16F) and
 *                 displayColor of it (RGBA8). background() costs ~3.7 ms at 3840×2160, so it is cached; the stars
 *                 twinkle and the sun breathes at MARCH_HZ / BG_EVERY Hz.
 * Every frame (the only pass of a frame without a march; each render pass has a fixed GPU cost):
 *   4. composite  at full resolution: displayColor(cloud.rgb + cloud.a × background), the clouds upsampled
 *                 bilaterally and shifted by the wind since the last resolve; clear sky reads the display cache.
 * After a reset (start, resize, invalidate) the first frame marches all four offsets, fills both caches and draws
 * the velocity grid (the cloud field's screen motion, RG16F; only the wind and the camera change it).
 */
import { TIERS, type CloudPipeline, type CloudUniforms, type PassContext, type QualityTier } from "./types";

/** Re-march rate cap (Hz). */
export const MARCH_HZ = 15;
/** Fresh-sample weight on its own pixel (the history keeps 1 − α). */
export const HISTORY_ALPHA = 0.25;

/**
 * α for the n-th march since a reset: a running mean while a pixel has fewer than 1 / HISTORY_ALPHA samples (each
 * pixel gets one every 4 marches), then HISTORY_ALPHA. Without it, the first second after a reset shows the 2×2
 * pattern of four single, differently jittered samples.
 */
export function historyAlpha(marchesSinceReset: number): number {
  return Math.max(HISTORY_ALPHA, 1 / (Math.floor(marchesSinceReset / 4) + 1));
}
/** 2×2 Bayer order: each pixel of a block is marched once every four marches. */
export const BAYER_2X2: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 1],
  [0, 1],
  [1, 0],
];
/** The background caches are redrawn on every this-many-th march. */
export const BG_EVERY = 4;
/** The velocity grid (cells across × down); the field is smooth, the composite samples it bilinearly. */
const VEL_GRID: [number, number] = [64, 36];
/** Slack (ms) so a 60 Hz display marches every 4th frame instead of alternating 3 and 5; the mean stays ≤ hz. */
const MARCH_SLACK_MS = 4;
const UNIT = { march: 4, history: 5, clouds: 6, vel: 7, bg: 8, display: 9 } as const;
type Unit = keyof typeof UNIT;
const SAMPLER: Record<Unit, string> = { march: "uRpMarch", history: "uRpHistory", clouds: "uRpClouds", vel: "uRpVel", bg: "uRpBg", display: "uRpDisplay" };

/** The cloud target's size for a drawing buffer and a tier scale (at least 2×2, even, so blocks tile it). */
export function cloudTargetSize(width: number, height: number, scale: number): [number, number] {
  const even = (n: number) => Math.max(2, 2 * Math.ceil((n * scale) / 2));
  return [even(width), even(height)];
}

/** March scheduler: true at most `hz` times a second on average; after a stall it restarts instead of bursting. */
export function createMarchClock(hz: number) {
  const interval = 1000 / hz;
  let next = -Infinity;
  return {
    due(nowMs: number): boolean {
      if (nowMs < next - MARCH_SLACK_MS) return false;
      next = nowMs - next > interval ? nowMs + interval : next + interval;
      return true;
    },
    reset() {
      next = -Infinity;
    },
  };
}

const MARCH_MAIN = /* glsl */ `
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy) * 2 + uRpOffset;
  vec4 c = marchClouds(uCamPos, viewRay((vec2(q) + 0.5) / uResolution));
  outColor = reprojectPack(c, gCloudDist);
}
`;
const RESOLVE_MAIN = /* glsl */ `
void main() {
  outColor = reprojectResolve(ivec2(gl_FragCoord.xy));
}
`;
const VELOCITY_MAIN = /* glsl */ `
void main() {
  outColor = vec4(reprojectVelocity(vUv), 0.0, 1.0);
}
`;
const BACKGROUND_MAIN = /* glsl */ `
void main() {
  outColor = vec4(background(viewRay(vUv)), 1.0);
}
`;
const DISPLAY_MAIN = /* glsl */ `
void main() {
  outColor = vec4(displayColor(texelFetch(uRpBg, ivec2(gl_FragCoord.xy), 0).rgb), 1.0);
}
`;
const COMPOSITE_MAIN = /* glsl */ `
void main() {
  outColor = reprojectComposite(vUv, ivec2(gl_FragCoord.xy));
}
`;

/** A render target; the canvas is { tex: null, fbo: null }. */
type Target = { tex: WebGLTexture | null; fbo: WebGLFramebuffer | null; w: number; h: number };
type Targets = { march: Target; history: [Target, Target]; vel: Target; bg: Target; display: Target };

/** CloudPipeline plus invalidate(): the scene changed (setState), so drop the history and refill the caches. */
export type VolPipeline = CloudPipeline & { invalidate(): void };

export function createPipeline(gl: WebGL2RenderingContext, tier: QualityTier): VolPipeline {
  const scale = TIERS[tier].scale;
  let t: Targets | null = null;
  let valid = false;
  let marches = 0;
  let sinceReset = 0;
  let resolvedAt = 0;
  const clock = createMarchClock(MARCH_HZ);
  const locs = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  const target = (w: number, h: number, internal: number, filter: number): Target => {
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // Incomplete means no float render targets (EXT_color_buffer_float, which renderer.ts enables).
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`[vol] target incomplete 0x${status.toString(16)}`);
    return { tex, fbo, w, h };
  };
  const freeAll = () => {
    if (!t) return;
    for (const x of [t.march, ...t.history, t.vel, t.bg, t.display]) {
      gl.deleteTexture(x.tex);
      gl.deleteFramebuffer(x.fbo);
    }
    t = null;
  };

  const resize = (width: number, height: number) => {
    if (t && t.bg.w === width && t.bg.h === height) return;
    freeAll();
    const [cw, ch] = cloudTargetSize(width, height, scale);
    t = {
      march: target(cw / 2, ch / 2, gl.RGBA32F, gl.NEAREST),
      history: [target(cw, ch, gl.RGBA16F, gl.LINEAR), target(cw, ch, gl.RGBA16F, gl.LINEAR)],
      vel: target(VEL_GRID[0], VEL_GRID[1], gl.RG16F, gl.LINEAR),
      bg: target(width, height, gl.RGBA16F, gl.NEAREST),
      display: target(width, height, gl.RGBA8, gl.NEAREST),
    };
    valid = false;
  };

  const loc = (p: WebGLProgram, name: string) => {
    let m = locs.get(p);
    if (!m) locs.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, gl.getUniformLocation(p, name));
    return m.get(name)!;
  };

  /**
   * Draws `main` into `out` with T7's samplers bound and its uRp uniforms set. A sampler whose texture is the
   * pass's own target gets a stand-in, so no pass has a feedback loop. Every pass overwrites its whole target, so
   * it clears first: a tile-based GPU then never loads the old contents.
   */
  const pass = (ctx: PassContext, key: string, main: string, out: Target, u: Record<string, number | [number, number]> = {}, overrides: Partial<CloudUniforms> = {}) => {
    const p = ctx.program(key, main);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, out.w, out.h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    ctx.apply(p, { uResolution: [out.w, out.h], ...overrides });
    const x = t!;
    const tex: Record<Unit, WebGLTexture | null> = { march: x.march.tex, history: x.history[0].tex, clouds: x.history[0].tex, vel: x.vel.tex, bg: x.bg.tex, display: x.display.tex };
    const standIn = out.tex === x.history[1].tex ? x.history[0].tex : x.history[1].tex;
    for (const k of Object.keys(UNIT) as Unit[]) {
      gl.activeTexture(gl.TEXTURE0 + UNIT[k]);
      gl.bindTexture(gl.TEXTURE_2D, tex[k] === out.tex ? standIn : tex[k]);
      const l = loc(p, SAMPLER[k]);
      if (l) gl.uniform1i(l, UNIT[k]);
    }
    for (const [name, v] of Object.entries(u)) {
      const l = loc(p, name);
      if (!l) continue;
      if (Array.isArray(v)) gl.uniform2i(l, v[0], v[1]);
      else gl.uniform1f(l, v);
    }
    ctx.fullscreen();
  };

  const marchAndResolve = (ctx: PassContext) => {
    const [prev, next] = t!.history;
    const [ox, oy] = BAYER_2X2[marches % 4]!;
    const offset: [number, number] = [ox, oy];
    // blueNoise() is indexed by the march target's pixel, so the four pixels of a block share its base value. uFrame
    // advances once per 4-march cycle: each pixel then sees the golden-ratio sequence once per update, and no pixel
    // of a block is biased against the others (a per-march uFrame leaves a 2×2 checker on thin cloud).
    // uResolution is the cloud target's.
    pass(ctx, "march", MARCH_MAIN, t!.march, { uRpOffset: offset }, { uResolution: [prev.w, prev.h], uFrame: Math.floor(marches / 4) });
    pass(ctx, "resolve", RESOLVE_MAIN, next, {
      uRpOffset: offset,
      uRpDt: valid ? Math.max(0, ctx.frame.time - resolvedAt) : 0,
      uRpValid: valid ? 1 : 0,
      uRpAlpha: historyAlpha(sinceReset),
    });
    t!.history = [next, prev];
    valid = true;
    marches++;
    sinceReset++;
    resolvedAt = ctx.frame.time;
  };

  return {
    resize,
    invalidate() {
      valid = false;
    },
    render(ctx) {
      resize(ctx.width, ctx.height);
      const full = !valid;
      if (full) {
        // A complete first image: all four offsets now, each replacing what it covers.
        clock.reset();
        sinceReset = 0;
        for (let i = 0; i < 4; i++) marchAndResolve(ctx);
      }
      const marched = clock.due(ctx.frame.nowMs) && !full;
      if (marched) marchAndResolve(ctx);
      if (full) pass(ctx, "velocity", VELOCITY_MAIN, t!.vel);
      if (full || (marched && marches % BG_EVERY === 0)) {
        pass(ctx, "background", BACKGROUND_MAIN, t!.bg);
        pass(ctx, "display", DISPLAY_MAIN, t!.display);
      }
      pass(ctx, "composite", COMPOSITE_MAIN, { tex: null, fbo: null, w: ctx.width, h: ctx.height }, { uRpDt: Math.max(0, ctx.frame.time - resolvedAt) });
    },
    dispose() {
      freeAll();
    },
  };
}
