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
 *
 * T11, out=layered: no full-resolution pass at all. The canvas this context draws is the cloud layer, its drawing
 * buffer at s_out × the full size (the browser stretches it), premultiplied over a second canvas, the background
 * layer (createBackgroundLayer, its own context at full resolution). Steps 3 and 4 become:
 *   3. background at s_out (linear RGBA16F, for the layered composite's b), and the background layer, on the frame
 *                 after every BG_EVERY-th march (not the march's own frame, so no frame pays for both)
 *   4. layered    every frame, at s_out: reprojectLayered (A = 1 − T, C = D(c + T·b) − T·D(b))
 */
import { blueNoise } from "@/lib/sky/volumetric/noise";
import { assembleFragment, VERTEX_SHADER } from "./assemble";
import { CLOUD_UNIFORMS, TEXTURE_UNITS, TIERS, type CloudPipeline, type CloudUniforms, type PassContext, type QualityTier } from "./types";

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
const LAYERED_MAIN = /* glsl */ `
void main() {
  outColor = reprojectLayered(vUv, ivec2(gl_FragCoord.xy));
}
`;
/** The background layer's one pass (its own context): what the single composite shows where the sky is clear. */
const BACKGROUND_LAYER_MAIN = /* glsl */ `
void main() {
  outColor = vec4(displayColor(background(viewRay(vUv))), 1.0);
}
`;

// ─── Output mode (T11) ────────────────────────────────────────────────────────────────────────────────────────────

export type OutputMode = "single" | "layered";
export type PipelineOutput = {
  mode: OutputMode;
  /** layered: the cloud canvas's drawing buffer as a fraction of the full one (s_out); null = the tier's scale. */
  sOut: number | null;
  /** layered: raise A to the least alpha that keeps C ≤ A, instead of clamping C (reprojectLayered). */
  lift: boolean;
  /** layered: paint where the C ≤ A clamp binds (reprojectLayered). */
  clampViz: boolean;
  /**
   * T7's option 1: draw the clouds only on march frames (and resets, background refreshes); in between, the canvas
   * holds its last frame, so the drift steps at the march rate instead of being shifted every frame.
   */
  hold: boolean;
};
export const SINGLE_OUTPUT: PipelineOutput = { mode: "single", sOut: null, lift: false, clampViz: false, hold: false };
/** The s_out range the lab accepts. */
export const S_OUT_RANGE: readonly [number, number] = [0.2, 1];

// TEMP until T9: T9 adds LabState.out ("single" | "layered"); until it is merged, out= is read here. sout=, lift=,
// clampviz= and hold= are T11's measurement parameters (docs/volumetric/handoffs/T11.md), read the same way.
export function readOutput(search: string): PipelineOutput {
  const q = new URLSearchParams(search);
  const hold = q.get("hold") === "1";
  if (q.get("out") !== "layered") return { ...SINGLE_OUTPUT, hold };
  const s = Number(q.get("sout"));
  const sOut = q.get("sout") && Number.isFinite(s) ? Math.min(S_OUT_RANGE[1], Math.max(S_OUT_RANGE[0], s)) : null;
  return { mode: "layered", sOut, lift: q.get("lift") !== "0", clampViz: q.get("clampviz") === "1", hold };
}

/** The layered cloud canvas's drawing buffer for a full drawing buffer and s_out. */
export function layeredSize(width: number, height: number, sOut: number): [number, number] {
  return [Math.max(1, Math.round(width * sOut)), Math.max(1, Math.round(height * sOut))];
}

/** Draws the background layer when asked, on its own context; the browser keeps showing it in between. */
export type BackgroundLayer = {
  resize(width: number, height: number): void;
  /** Once per frame: draw now (the BG cadence or a reset) or leave the canvas as it is. */
  present(draw: boolean): void;
  /** Amortised GPU ms per frame (per-draw ms × draws per frame), and the last measured draws (ms). */
  stats(): { gpuMs: number | null; drawMs: number[] };
  dispose(): void;
};

/** Frames the background layer's amortised GPU time is measured over. */
const BG_STATS_FRAMES = 240;
const BG_PENDING_QUERIES = 4;

/**
 * The background canvas (T11, out=layered): its own WebGL2 context at the full drawing buffer, running background()
 * alone, with its own blue-noise texture and timer query. `uniforms` gives the renderer's values for this frame.
 */
export function createBackgroundLayer(canvas: HTMLCanvasElement, tier: QualityTier, uniforms: () => CloudUniforms | null): BackgroundLayer {
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "high-performance" });
  if (!gl) throw new Error("[vol] WebGL2 unavailable (background layer)");
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("[vol] bg layer compile: " + (gl.getShaderInfoLog(s) ?? "").split("\n")[0]);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, assembleFragment(BACKGROUND_LAYER_MAIN, tier)));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("[vol] bg layer link: " + gl.getProgramInfoLog(p));
  const vao = gl.createVertexArray();
  const blue = gl.createTexture()!;
  const size = Math.round(Math.sqrt(blueNoise().length));
  gl.bindTexture(gl.TEXTURE_2D, blue);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, blueNoise());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const locs = new Map<string, WebGLUniformLocation | null>();
  const loc = (name: string) => {
    if (!locs.has(name)) locs.set(name, gl.getUniformLocation(p, name));
    return locs.get(name)!;
  };
  gl.useProgram(p);
  // Every sampler on its own unit (types must not share one); only uBlue has a texture.
  for (const [name, unit] of Object.entries(TEXTURE_UNITS)) {
    const l = loc(name);
    if (l) gl.uniform1i(l, unit);
  }
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const pending: WebGLQuery[] = [];
  const drawMs: number[] = [];
  const drewAt: number[] = [];
  let frame = 0;

  return {
    resize(width, height) {
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    },
    present(draw) {
      frame++;
      while (timer && pending.length && gl.getQueryParameter(pending[0]!, gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift()!;
        if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
          drawMs.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          if (drawMs.length > 16) drawMs.shift();
        }
        gl.deleteQuery(q);
      }
      const u = uniforms();
      if (!draw || !u) return;
      drewAt.push(frame);
      while (drewAt.length && drewAt[0]! <= frame - BG_STATS_FRAMES) drewAt.shift();
      const q = timer && pending.length < BG_PENDING_QUERIES ? gl.createQuery() : null;
      if (q) gl.beginQuery(timer!.TIME_ELAPSED_EXT, q);
      gl.useProgram(p);
      const values = { ...u, uResolution: [canvas.width, canvas.height] } as Record<string, number | number[]>;
      for (const [name, v] of Object.entries(values)) {
        const l = loc(name);
        if (!l) continue;
        if (typeof v === "number") (CLOUD_UNIFORMS[name as keyof typeof CLOUD_UNIFORMS] === "int" ? gl.uniform1i : gl.uniform1f).call(gl, l, v);
        else if (v.length === 2) gl.uniform2fv(l, v);
        else if (v.length === 3) gl.uniform3fv(l, v);
        else gl.uniform4fv(l, v);
      }
      gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNITS.uBlue);
      gl.bindTexture(gl.TEXTURE_2D, blue);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (q) {
        gl.endQuery(timer!.TIME_ELAPSED_EXT);
        pending.push(q);
      }
    },
    stats() {
      if (!drawMs.length) return { gpuMs: null, drawMs: [...drawMs] };
      const mean = drawMs.reduce((a, b) => a + b, 0) / drawMs.length;
      return { gpuMs: (mean * drewAt.length) / Math.min(frame, BG_STATS_FRAMES), drawMs: [...drawMs] };
    },
    dispose() {
      pending.forEach((q) => gl.deleteQuery(q));
      gl.deleteProgram(p);
      gl.deleteTexture(blue);
      gl.deleteVertexArray(vao);
    },
  };
}

/** A render target; the canvas is { tex: null, fbo: null }. */
type Target = { tex: WebGLTexture | null; fbo: WebGLFramebuffer | null; w: number; h: number };
/** `display` exists in single mode only; in layered mode `bg` is at s_out. */
type Targets = { march: Target; history: [Target, Target]; vel: Target; bg: Target; display: Target | null };

/** CloudPipeline plus invalidate() (now part of CloudPipeline, T11); kept as an alias for the renderer. */
export type VolPipeline = CloudPipeline;

/**
 * The frame's passes for a tier. `output` picks the single full-resolution composite (T7) or the layered output
 * (T11), which also needs `background`, the background layer.
 */
export function createPipeline(gl: WebGL2RenderingContext, tier: QualityTier, output: PipelineOutput = SINGLE_OUTPUT, background: BackgroundLayer | null = null): VolPipeline {
  const scale = TIERS[tier].scale;
  const layered = output.mode === "layered";
  const sOut = output.sOut ?? scale;
  let t: Targets | null = null;
  let full: [number, number] = [0, 0];
  let valid = false;
  let marches = 0;
  let sinceReset = 0;
  let resolvedAt = 0;
  let bgNext = false;
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
    for (const x of [t.march, ...t.history, t.vel, t.bg, ...(t.display ? [t.display] : [])]) {
      gl.deleteTexture(x.tex);
      gl.deleteFramebuffer(x.fbo);
    }
    t = null;
  };

  const resize = (width: number, height: number) => {
    if (t && full[0] === width && full[1] === height) return;
    freeAll();
    full = [width, height];
    const [cw, ch] = cloudTargetSize(width, height, scale);
    const [ow, oh] = layered ? layeredSize(width, height, sOut) : [width, height];
    if (layered) {
      // The cloud canvas is this context's own; the renderer leaves its size to the pipeline in layered mode.
      const c = gl.canvas as HTMLCanvasElement;
      if (c.width !== ow || c.height !== oh) {
        c.width = ow;
        c.height = oh;
      }
      background?.resize(width, height);
    }
    t = {
      march: target(cw / 2, ch / 2, gl.RGBA32F, gl.NEAREST),
      history: [target(cw, ch, gl.RGBA16F, gl.LINEAR), target(cw, ch, gl.RGBA16F, gl.LINEAR)],
      vel: target(VEL_GRID[0], VEL_GRID[1], gl.RG16F, gl.LINEAR),
      bg: target(ow, oh, gl.RGBA16F, gl.NEAREST),
      display: layered ? null : target(width, height, gl.RGBA8, gl.NEAREST),
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
    const tex: Record<Unit, WebGLTexture | null> = { march: x.march.tex, history: x.history[0].tex, clouds: x.history[0].tex, vel: x.vel.tex, bg: x.bg.tex, display: x.display?.tex ?? null };
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
      const reset = !valid;
      if (reset) {
        // A complete first image: all four offsets now, each replacing what it covers.
        clock.reset();
        sinceReset = 0;
        for (let i = 0; i < 4; i++) marchAndResolve(ctx);
      }
      const marched = clock.due(ctx.frame.nowMs) && !reset;
      if (marched) marchAndResolve(ctx);
      if (reset) pass(ctx, "velocity", VELOCITY_MAIN, t!.vel);
      const bgDue = marched && marches % BG_EVERY === 0;
      const dt = { uRpDt: Math.max(0, ctx.frame.time - resolvedAt) };
      if (!layered) {
        if (reset || bgDue) {
          pass(ctx, "background", BACKGROUND_MAIN, t!.bg);
          pass(ctx, "display", DISPLAY_MAIN, t!.display!);
        }
        // hold: nothing changed since the last drawn frame, so the canvas keeps showing it.
        if (output.hold && !reset && !marched) return;
        pass(ctx, "composite", COMPOSITE_MAIN, { tex: null, fbo: null, w: ctx.width, h: ctx.height }, dt);
        return;
      }
      // Layered: the background refresh waits for the frame after the march, so no frame pays for both.
      const bgNow = reset || bgNext;
      bgNext = bgDue;
      if (bgNow) pass(ctx, "background", BACKGROUND_MAIN, t!.bg);
      background?.present(bgNow);
      if (output.hold && !reset && !marched && !bgNow) return;
      const [ow, oh] = layeredSize(ctx.width, ctx.height, sOut);
      pass(ctx, "layered", LAYERED_MAIN, { tex: null, fbo: null, w: ow, h: oh }, { ...dt, uRpLift: output.lift ? 1 : 0, uRpClampViz: output.clampViz ? 1 : 0 });
    },
    dispose() {
      freeAll();
    },
  };
}
