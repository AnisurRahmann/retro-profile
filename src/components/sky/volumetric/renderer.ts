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
import { createBackgroundLayer, createPipeline, readOutput, SINGLE_OUTPUT, type BackgroundLayer, type PipelineOutput, type VolPipeline } from "./targets";
import { createTierGovernor, resolveTier, STEP_DOWN_MS, STEP_DOWN_WINDOW_MS } from "./tiers";
import {
  CLOUD_TYPE_VALUE,
  CLOUD_UNIFORMS,
  GEOMETRY,
  SHADER_DEBUG_VIEWS,
  TEXTURE_UNITS,
  type CloudUniformName,
  type CloudUniforms,
  type DebugContext,
  type FrameInfo,
  type FrameTime,
  type LabScene,
  type LabState,
  type NoiseTextures,
  type PassContext,
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

export type RendererOptions = {
  /** Where a JS debug view mounts its UI. */
  overlay?: HTMLElement | null;
  /** out=layered (T11): the background canvas under `canvas`, which then becomes the transparent cloud layer. */
  background?: HTMLCanvasElement | null;
};

/** T11's layered-output numbers on window.__vol (Request for M1: fields of VolDebug). */
type LayeredDebug = { out: PipelineOutput["mode"]; bgGpuMs: number | null; bgDrawMs: number[] };

/** Starts the lab renderer on a canvas. Rejects if WebGL2 is unavailable or a shader fails to compile. */
export async function startRenderer(canvas: HTMLCanvasElement, initial: LabState, opts: RendererOptions = {}): Promise<VolRenderer> {
  // TEMP until T9: the output mode comes from the URL (readOutput); T9's LabState.out replaces it.
  const asked = readOutput(window.location.search);
  const output: PipelineOutput = asked.mode === "layered" && !opts.background ? { ...SINGLE_OUTPUT, hold: asked.hold } : asked;
  const layered = output.mode === "layered";
  // The layered cloud canvas is premultiplied over the background canvas (T11).
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: layered, depth: false, stencil: false, premultipliedAlpha: layered, powerPreference: "high-performance" });
  if (!gl) throw new Error("[vol] WebGL2 unavailable");
  // RGBA16F render targets (T7) need it; enabling it here keeps targets.ts free of context setup.
  gl.getExtension("EXT_color_buffer_float");
  const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2") as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const vao = gl.createVertexArray();

  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  let state = initial;
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
  const debug: VolDebug & LayeredDebug = { frames: 0, ready: false, tier, gpuMs: null, times, state, noiseMs: noise.genMs, error: null, out: output.mode, bgGpuMs: null, bgDrawMs: [] };
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
        pipeline.render(ctx);
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
      state = next;
      debug.state = next;
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
      bgLayer?.dispose();
      noise.dispose();
      weather!.dispose();
      programs.forEach((p) => gl.deleteProgram(p));
      pending.forEach((x) => gl.deleteQuery(x));
    },
  };
}
