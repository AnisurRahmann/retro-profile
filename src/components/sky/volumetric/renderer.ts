/**
 * The lab's renderer entry (owner T0): context, tiers, noise, weather map, uniforms, the pipeline, timing and the
 * hook API (VolRenderer in types.ts). Later tasks plug in through their own files; nobody else edits this one.
 */
import { forcedCellFor } from "@/lib/sky/volumetric/sun-cell";
import { sceneFor } from "@/lib/sky/volumetric/scene";
import { createWeatherMap } from "@/lib/sky/volumetric/weather-map";
import { assembleFragment, VERTEX_SHADER } from "./assemble";
import { debugView, registerDebugView } from "./debug-views";
import { createNoiseTextures } from "./noise-gpu";
import { createBackgroundLayer, createPipeline, outputFor, sameOutput, type VolPipeline } from "./targets";
import { createTierGovernor, resolveTier, STEP_DOWN_MS, STEP_DOWN_WINDOW_MS } from "./tiers";
import {
  CLOUD_TYPE_VALUE,
  CLOUD_UNIFORMS,
  GEOMETRY,
  SHADER_DEBUG_VIEWS,
  TEXTURE_UNITS,
  type BackgroundLayer,
  type CloudUniformName,
  type CloudUniforms,
  type DebugContext,
  type FrameInfo,
  type FrameTime,
  type LabScene,
  type LabState,
  type NoiseTextures,
  type PassContext,
  type PipelineOutput,
  type QualityTier,
  type VolDebug,
  type VolRenderer,
  type WeatherMap,
  type WeatherMapParams,
} from "./types";

const TIMES_KEPT = 120;
/**
 * window.__vol.gpuMs is the mean over this many measured frames (T7). The pipeline's cost is periodic (a march every
 * ~4 frames, at most 15 Hz), so a single frame's time, sampled at a fixed interval (lab:gpu polls every 100 ms),
 * aliases with it and lands on march frames either half the time or never. Each finished query counts once.
 */
const GPU_MEAN_FRAMES = 60;
/** Queries in flight; enough that every frame is measured while results come back a few frames late. */
const MAX_PENDING_QUERIES = 8;
const CELL_REFRESH_MS = 1000;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? "";
    gl.deleteShader(s);
    // Line numbers in the log refer to the assembled source: print it numbered next to the error.
    const numbered = src.split("\n").map((l, i) => `${String(i + 1).padStart(4)} ${l}`).join("\n");
    console.error(`[vol] compile: ${log}\n${numbered}`);
    throw new Error(`[vol] compile: ${log.split("\n")[0]}`);
  }
  return s;
}

function link(gl: WebGL2RenderingContext, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`[vol] link failed: ${gl.getProgramInfoLog(p)}`);
  return p;
}

const INT_UNIFORMS = new Set(Object.entries(CLOUD_UNIFORMS).filter(([, t]) => t === "int").map(([n]) => n));

function uniformsFor(scene: LabScene, s: LabState, w: WeatherMap, frame: FrameInfo, width: number, height: number): CloudUniforms {
  return {
    uResolution: [width, height],
    uViewport: [width, height],
    uTime: frame.time,
    uFrame: frame.index,
    uDebug: SHADER_DEBUG_VIEWS.indexOf(s.debug as (typeof SHADER_DEBUG_VIEWS)[number]) + 1,
    uExposure: 1,
    uCamPos: [0, GEOMETRY.CAMERA_ALT, 0],
    uCamForward: scene.camera.forward,
    uCamRight: scene.camera.right,
    uCamUp: scene.camera.up,
    uTanHalfFov: scene.camera.tanHalfFov,
    uAspect: width / Math.max(1, height),
    uSunDir: scene.sun.dir,
    uSunColor: scene.sun.colour,
    uSunElev: scene.sun.elDeg,
    uSunVisible: scene.sun.visible,
    uMoonDir: scene.moon.dir,
    uMoonFraction: scene.moon.fraction,
    uMoonPhase: scene.moon.phase,
    uMoonAngle: scene.moon.angle,
    uMoonVisible: scene.moon.visible,
    uZenith: scene.sky.zenith,
    uMid: scene.sky.mid,
    uHorizonCol: scene.sky.horizon,
    uGround: scene.sky.ground,
    uStarAlpha: scene.stars.alpha,
    uStarSeed: scene.stars.seed,
    uStarWarm: scene.stars.warm,
    uStarCool: scene.stars.cool,
    uCoverage: s.cov,
    uCloudType: CLOUD_TYPE_VALUE[s.type],
    uPrecip: s.precip,
    uWeatherOffset: w.offset,
    uWindVel: w.velocity,
  };
}

/**
 * The hooks applyReviewParams hands the frame loop (T10; M2 reads them from LabState, T9's fields). Every one is a
 * no-op for a state with reproject 1 and accum 0. The cloud target's scale is the pipeline's (PipelineOutput.scale).
 */
type ReviewHooks = {
  /** The state the frame loop runs: accum freezes the clock. */
  state(s: LabState): LabState;
  /** Before the pipeline renders: false = skip it (the mean is complete and only needs presenting). */
  before(p: VolPipeline, s: LabState): boolean;
  /** After the pipeline drew the canvas: fold it into the running mean and present the mean. */
  after(ctx: PassContext, s: LabState): void;
  /** VolDebug.accumReady: the N frames are in (always true for accum 0). */
  ready(s: LabState): boolean;
  /** A new scene, tier or size: restart the mean. */
  reset(): void;
  dispose(): void;
};

/**
 * T10's review params, for 100% crops and reference renders (A-ref: scale=1&reproject=0&accum=64):
 * - `reproject=0`: every pixel is marched every frame and the history is bypassed. The pipeline is invalidated before
 *   each frame (its public API), so it marches all four offsets with α 1 (`historyAlpha` of a reset).
 * - `accum=N` (1..256): the clock freezes, the jitter keeps advancing (uFrame follows the marches), and the canvas shows
 *   the running mean of N frames (display values, RGBA32F ping-pong), then holds it without rendering. Single output
 *   only (outputFor), because the mean is read back from the one opaque canvas.
 * - `scale` goes to createPipeline through outputFor; the camera azimuth is `view`.
 */
function applyReviewParams(gl: WebGL2RenderingContext): ReviewHooks {
  let acc: { tex: WebGLTexture; fbo: WebGLFramebuffer }[] = [];
  let src: WebGLTexture | null = null;
  let size: [number, number] = [0, 0];
  let n = 0;
  const free = () => {
    acc.forEach((a) => (gl.deleteTexture(a.tex), gl.deleteFramebuffer(a.fbo)));
    if (src) gl.deleteTexture(src);
    acc = [];
    src = null;
  };
  const tex2d = (w: number, h: number, internal: number) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return t;
  };
  // mix(prev, src, w): w = 1/k folds frame k into the mean; w = 0 presents it. (uRvW is a vec2 only so the copy
  // scan doesn't read the declaration as prose.)
  const MAIN = /* glsl */ `
uniform sampler2D uRvPrev;
uniform sampler2D uRvSrc;
uniform vec2 uRvW;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  outColor = vec4(mix(texelFetch(uRvPrev, c, 0).rgb, texelFetch(uRvSrc, c, 0).rgb, uRvW.x), 1.0);
}
`;
  const UNITS = [10, 11] as const;
  const draw = (ctx: PassContext, prev: WebGLTexture, cur: WebGLTexture, w: number, fbo: WebGLFramebuffer | null) => {
    const p = ctx.program("review-accum", MAIN);
    ctx.apply(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, ctx.width, ctx.height);
    [prev, cur].forEach((t, i) => {
      gl.activeTexture(gl.TEXTURE0 + UNITS[i]!);
      gl.bindTexture(gl.TEXTURE_2D, t);
    });
    gl.uniform1i(gl.getUniformLocation(p, "uRvPrev"), UNITS[0]);
    gl.uniform1i(gl.getUniformLocation(p, "uRvSrc"), UNITS[1]);
    gl.uniform2f(gl.getUniformLocation(p, "uRvW"), w, 0);
    ctx.fullscreen();
  };

  return {
    state: (s) => (s.accum > 0 && !s.freeze ? { ...s, freeze: true } : s),
    before(p, s) {
      if (s.accum > 0 && n >= s.accum) return false;
      if (s.reproject === 0) p.invalidate();
      return true;
    },
    after(ctx, s) {
      const accum = s.accum;
      if (accum <= 0) return;
      if (size[0] !== ctx.width || size[1] !== ctx.height) {
        free();
        size = [ctx.width, ctx.height];
        n = 0;
      }
      if (!src) {
        // RGB8: the canvas has no alpha (alpha: false), and a copy can't add components.
        src = tex2d(ctx.width, ctx.height, gl.RGB8);
        acc = [0, 1].map(() => {
          const tex = tex2d(ctx.width, ctx.height, gl.RGBA32F);
          const fbo = gl.createFramebuffer()!;
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
          return { tex, fbo };
        });
      }
      if (n < accum) {
        // The canvas holds this frame's composite: copy it, fold it into the mean.
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, src);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, ctx.width, ctx.height);
        n++;
        draw(ctx, acc[0]!.tex, src, 1 / n, acc[1]!.fbo);
        acc.reverse();
      }
      draw(ctx, acc[0]!.tex, acc[0]!.tex, 0, null);
    },
    ready: (s) => s.accum <= 0 || n >= s.accum,
    reset() {
      n = 0;
    },
    dispose: free,
  };
}

export type RendererOptions = {
  /** Where a JS debug view mounts its UI. */
  overlay?: HTMLElement | null;
  /** out=layered (T11): the background canvas under `canvas`, which then becomes the transparent cloud layer. */
  background?: HTMLCanvasElement | null;
};

/** Starts the lab renderer on a canvas. Rejects if WebGL2 is unavailable or a shader fails to compile. */
export async function startRenderer(canvas: HTMLCanvasElement, initial: LabState, opts: RendererOptions = {}): Promise<VolRenderer> {
  // The output (T11) comes from the state (T9's LabState.out and friends). Its mode is fixed for the context's life
  // (alpha and premultipliedAlpha are context attributes), so the panel reloads the page to change it; the other
  // switches rebuild the pipeline (setState). Layered needs the background canvas.
  const layered = outputFor(initial).mode === "layered" && !!opts.background;
  /** The output for a state, within this context's mode (a state asking for the other mode gets this one's). */
  const fitOutput = (s: LabState): PipelineOutput => outputFor(layered ? { ...s, out: "layered", accum: 0, debug: "" } : { ...s, out: "single" });
  /** A layered context can't take a reference mean or a debug view (both need the single canvas) until the reload. */
  const fitState = (s: LabState): LabState => (layered && (s.accum > 0 || s.debug !== "") ? { ...s, accum: 0, debug: "" } : s);
  let output = fitOutput(initial);
  // The layered cloud canvas is premultiplied over the background canvas (T11).
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: layered, depth: false, stencil: false, premultipliedAlpha: layered, powerPreference: "high-performance" });
  if (!gl) throw new Error("[vol] WebGL2 unavailable");
  // RGBA16F render targets (T7) need it; enabling it here keeps targets.ts free of context setup.
  gl.getExtension("EXT_color_buffer_float");
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const vao = gl.createVertexArray();

  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const review = applyReviewParams(gl);
  let state = review.state(fitState(initial));
  let tier: QualityTier = resolveTier(state.tier, { coarsePointer: coarse });
  let scene = sceneFor(state);
  let noise: NoiseTextures = await createNoiseTextures(gl, tier);
  let weather: WeatherMap | null = null;
  const weatherParams = (): WeatherMapParams => ({ ...scene.weather, forcedCell: forcedCellFor(state, scene, weather?.offset ?? [0, 0]) });
  weather = createWeatherMap(gl, weatherParams());
  let uniforms: CloudUniforms | null = null;
  const bgLayer: BackgroundLayer | null = layered ? createBackgroundLayer(opts.background!, tier, () => uniforms) : null;
  let pipeline: VolPipeline = createPipeline(gl, tier, output, bgLayer);
  let governor = createTierGovernor(tier, state.tier === "auto");
  let programs = new Map<string, WebGLProgram>();
  const locations = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

  let width = 1;
  let height = 1;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (w === width && h === height) return;
    width = w;
    height = h;
    // Layered: the pipeline sizes the cloud canvas (s_out × this) and the background canvas.
    if (!layered) [canvas.width, canvas.height] = [w, h];
    pipeline.resize(w, h);
    review.reset();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const program = (key: string, main: string): WebGLProgram => {
    const k = `${tier}:${key}`;
    let p = programs.get(k);
    if (!p) {
      p = link(gl, assembleFragment(main, tier));
      programs.set(k, p);
    }
    return p;
  };
  const loc = (p: WebGLProgram, name: string) => {
    let m = locations.get(p);
    if (!m) locations.set(p, (m = new Map()));
    if (!m.has(name)) m.set(name, gl.getUniformLocation(p, name));
    return m.get(name)!;
  };
  const apply = (p: WebGLProgram, overrides: Partial<CloudUniforms> = {}) => {
    gl.useProgram(p);
    const values = { ...uniforms!, ...overrides } as Record<string, number | number[]>;
    for (const [name, v] of Object.entries(values)) {
      const l = loc(p, name);
      if (!l) continue;
      if (typeof v === "number") (INT_UNIFORMS.has(name) ? gl.uniform1i : gl.uniform1f).call(gl, l, v);
      else if (v.length === 2) gl.uniform2fv(l, v);
      else if (v.length === 3) gl.uniform3fv(l, v);
      else gl.uniform4fv(l, v);
    }
    const tex: Record<keyof typeof TEXTURE_UNITS, [number, WebGLTexture]> = {
      uShape: [gl.TEXTURE_3D, noise.shape],
      uDetail: [gl.TEXTURE_3D, noise.detail],
      uBlue: [gl.TEXTURE_2D, noise.blue],
      uWeather: [gl.TEXTURE_2D, weather!.texture],
    };
    for (const [name, unit] of Object.entries(TEXTURE_UNITS) as [keyof typeof TEXTURE_UNITS, number][]) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(tex[name][0], tex[name][1]);
      const l = loc(p, name satisfies CloudUniformName);
      if (l) gl.uniform1i(l, unit);
    }
  };
  const fullscreen = () => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const listeners = new Set<(t: FrameTime) => void>();
  const times: FrameTime[] = [];
  const pending: WebGLQuery[] = [];
  let lastGpu: number | null = null;
  const gpuWindow: number[] = [];
  const debug: VolDebug = {
    frames: 0,
    ready: false,
    tier,
    gpuMs: null,
    times,
    state,
    noiseMs: noise.genMs,
    error: null,
    accumReady: review.ready(state),
    out: output.mode,
    bgGpuMs: null,
    bgDrawMs: [],
  };
  window.__vol = debug;
  console.info(`[vol] tier ${tier}, noise ${noise.genMs.toFixed(1)} ms`);

  let mounted: { name: string; unmount: (() => void) | null } | null = null;
  const syncDebugMount = () => {
    const name = debugView(state.debug) ? state.debug : null;
    if (mounted?.name === name) return;
    mounted?.unmount?.();
    mounted = null;
    const v = name ? debugView(name) : undefined;
    if (name && v) mounted = { name, unmount: v.mount && opts.overlay ? v.mount(opts.overlay) : null };
  };

  const rebuildForTier = async (next: QualityTier) => {
    if (next === tier) return;
    const fresh = await createNoiseTextures(gl, next);
    tier = next;
    noise.dispose();
    noise = fresh;
    pipeline.dispose();
    pipeline = createPipeline(gl, tier, output, bgLayer);
    review.reset();
    pipeline.resize(width, height);
    programs.forEach((p) => gl.deleteProgram(p));
    programs = new Map();
    debug.tier = tier;
    debug.noiseMs = noise.genMs;
    console.info(`[vol] tier ${tier}`);
  };

  let time = 0;
  let index = 0;
  let last = performance.now();
  let lastCell = last;
  let raf = 0;
  let stopped = false;

  const frame = (now: number) => {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const t0 = performance.now();
    const rafMs = now - last;
    const dt = state.freeze ? 0 : Math.min(0.1, rafMs / 1000);
    last = now;
    time += dt;
    weather!.update(dt);
    if (now - lastCell > CELL_REFRESH_MS) {
      lastCell = now;
      weather!.setParams(weatherParams());
    }
    const info: FrameInfo = { nowMs: now, dt, time, index: index++ };
    uniforms = uniformsFor(scene, state, weather!, info, width, height);

    // GPU time: one query per frame, read back when the result is available (a few frames later).
    while (timer && pending.length && gl.getQueryParameter(pending[0]!, gl.QUERY_RESULT_AVAILABLE)) {
      const q = pending.shift()!;
      if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) {
        lastGpu = gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6;
        gpuWindow.push(lastGpu);
        if (gpuWindow.length > GPU_MEAN_FRAMES) gpuWindow.shift();
      }
      gl.deleteQuery(q);
    }
    const q = timer && pending.length < MAX_PENDING_QUERIES ? gl.createQuery() : null;
    if (q) gl.beginQuery(timer!.TIME_ELAPSED_EXT, q);
    try {
      const view = debugView(state.debug);
      if (view) {
        const ctx: DebugContext = { gl, width, height, frame: info, noise, weather: weather!, program, apply, fullscreen };
        view.draw(ctx);
      } else {
        const ctx: PassContext = { gl, tier, width, height, frame: info, weather: weather!, program, apply, fullscreen };
        if (review.before(pipeline, state)) pipeline.render(ctx);
        review.after(ctx, state);
      }
    } catch (e) {
      debug.error = e instanceof Error ? e.message : String(e);
      stopped = true;
      cancelAnimationFrame(raf);
      throw e;
    } finally {
      if (q) {
        gl.endQuery(timer!.TIME_ELAPSED_EXT);
        pending.push(q);
      }
    }

    const ft: FrameTime = { gpuMs: lastGpu, cpuMs: performance.now() - t0, rafMs, tier };
    times.push(ft);
    if (times.length > TIMES_KEPT) times.shift();
    debug.frames++;
    debug.ready = true;
    debug.accumReady = review.ready(state);
    debug.gpuMs = gpuWindow.length ? gpuWindow.reduce((a, b) => a + b, 0) / gpuWindow.length : null;
    if (bgLayer) ({ gpuMs: debug.bgGpuMs, drawMs: debug.bgDrawMs } = bgLayer.stats());
    listeners.forEach((cb) => cb(ft));
    // The governor watches the frame time the viewer gets (the rAF interval). Per-frame GPU time is bimodal with the
    // 15 Hz re-march (most frames only composite), so its median would never see a slow march.
    const down = governor.sample(rafMs, now);
    if (down) {
      // e.g. "[vol] auto → medium: median 20+ ms / 3 s".
      console.info(`[vol] auto → ${down}: median ${STEP_DOWN_MS}+ ms`, `/ ${STEP_DOWN_WINDOW_MS / 1000} s`);
      void rebuildForTier(down);
    }
  };
  syncDebugMount();
  raf = requestAnimationFrame(frame);

  return {
    gl,
    get tier() {
      return tier;
    },
    setState(next) {
      const prevTier = state.tier;
      if (outputFor(next).mode !== output.mode) console.info(`[vol] out=${next.out}, accum=${next.accum}: needs a reload (a new context)`);
      state = next = review.state(fitState(next));
      review.reset();
      debug.accumReady = review.ready(next);
      debug.state = next;
      const nextOutput = fitOutput(next);
      if (!sameOutput(nextOutput, output)) {
        // scale, sout, lift, clampviz or hold changed: the same context, a new pipeline.
        output = nextOutput;
        pipeline.dispose();
        pipeline = createPipeline(gl, tier, output, bgLayer);
        pipeline.resize(width, height);
      }
      scene = sceneFor(next);
      weather!.setParams(weatherParams());
      // A new scene: drop the reprojection history and refill the background caches (T7).
      pipeline.invalidate();
      if (next.tier !== prevTier) {
        governor = createTierGovernor(resolveTier(next.tier, { coarsePointer: coarse }), next.tier === "auto");
        void rebuildForTier(resolveTier(next.tier, { coarsePointer: coarse }));
      }
      syncDebugMount();
    },
    registerDebugView(name, view) {
      registerDebugView(name, view);
      syncDebugMount();
    },
    onFrameTime(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    dispose() {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      mounted?.unmount?.();
      pipeline.dispose();
      review.dispose();
      bgLayer?.dispose();
      noise.dispose();
      weather!.dispose();
      programs.forEach((p) => gl.deleteProgram(p));
      pending.forEach((x) => gl.deleteQuery(x));
    },
  };
}
