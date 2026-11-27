/**
 * Noise textures on the GPU (owner T1): SHAPE, DETAIL and BLUE as typed in types.ts (NoiseTextures).
 *
 * One fragment shader per texture (noise/glsl.ts, written out from the recipes) renders every z slice of SHAPE and
 * DETAIL into its 3D texture, through a framebuffer, once per session. A tier change asks for the other SHAPE size;
 * calls that overlap on one context (dev's StrictMode starts the renderer twice) share one run. BLUE is void-and-cluster
 * blue noise made on the CPU once (noise/blue.ts).
 *
 * genMs is wall time until the textures are complete, shaders included, and it is logged (BRIEF: under 150 ms).
 * Complete means read back: on Chrome through ANGLE Metal gl.finish() returns before the GPU is done (measured: 0.1 ms
 * for a 128³ volume that took 20 ms), so every volume ends in a 1×1 readPixels, which must wait for what precedes it.
 *
 * What the 150 ms covers: every load but a browser's first. Measured in the lab on an Apple M2 under load, with the
 * shaders already compiled: 92 ms at the high tier (SHAPE 50, DETAIL 6, BLUE 10 on the CPU, 26 linking), 44 ms at
 * medium and 51 ms at low. The first load of a browser process compiles the shaders, and that one-time wait was
 * 160–900 ms here, depending on the machine's load; Chrome and the OS cache it. The log line shows each part.
 *
 * This module also owns the ?debug=noise view: the eight channels as slices at a z picked on a slider.
 */
import {
  BLUE_SIZE,
  NOISE_VERTEX,
  SLICE_TILES,
  SLICE_VIEW_MAIN,
  blueNoise,
  detailFragment,
  mipLevels,
  shapeFragment,
  sliceLayout,
  type SliceLayout,
} from "@/lib/sky/volumetric/noise";
import { registerDebugView } from "./debug-views";
import {
  TIERS,
  type CreateNoiseTextures,
  type DebugView,
  type QualityTier,
  type Vec3,
} from "./types";

/** BRIEF: generating the textures must take under this. */
const GENERATION_BUDGET_MS = 150;

/** The three textures and their size, before the handle that owns them. */
type Noise = {
  shape: WebGLTexture;
  detail: WebGLTexture;
  blue: WebGLTexture;
  shapeSize: 64 | 128;
  genMs: number;
};
/** A tier's noise on one context: the run in progress or done, and how many handles still own it. */
type Entry = { run: Promise<Noise>; refs: number };

/** Per context, per tier. A WeakMap, so a context that goes away takes its textures' bookkeeping with it. */
const cache = new WeakMap<WebGL2RenderingContext, Map<QualityTier, Entry>>();
/** The generation programs by source, linked once per context. */
const programs = new WeakMap<WebGL2RenderingContext, Map<string, WebGLProgram>>();

const locations = new WeakMap<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
function loc(
  gl: WebGL2RenderingContext,
  p: WebGLProgram,
  name: string,
): WebGLUniformLocation | null {
  let m = locations.get(p);
  if (!m) locations.set(p, (m = new Map()));
  if (!m.has(name)) m.set(name, gl.getUniformLocation(p, name));
  return m.get(name)!;
}

function link(gl: WebGL2RenderingContext, fragment: string): WebGLProgram {
  if (gl.isContextLost()) throw new Error("[vol] noise: the context is lost");
  const p = gl.createProgram()!;
  for (const [type, src] of [
    [gl.VERTEX_SHADER, NOISE_VERTEX],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) ?? "";
      gl.deleteShader(s);
      console.error(`[vol] noise shader: ${log}`);
      throw new Error(`[vol] noise shader: ${log.split("\n")[0]}`);
    }
    gl.attachShader(p, s);
    gl.deleteShader(s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw new Error(`[vol] noise link: ${gl.getProgramInfoLog(p)}`);
  return p;
}

/** The program for `fragment`, compiled on first use. A restored context keeps its WebGLProgram objects empty, so they go then. */
function program(gl: WebGL2RenderingContext, key: string, fragment: string): WebGLProgram {
  let byKey = programs.get(gl);
  if (!byKey) {
    programs.set(gl, (byKey = new Map()));
    (gl.canvas as HTMLCanvasElement).addEventListener(
      "webglcontextrestored",
      () => programs.delete(gl),
      { once: true },
    );
  }
  let p = byKey.get(key);
  if (!p) byKey.set(key, (p = link(gl, fragment)));
  return p;
}

const CAPS = ["BLEND", "SCISSOR_TEST", "CULL_FACE", "DEPTH_TEST", "RASTERIZER_DISCARD"] as const;

/** Runs `work` with a plain pass-through state on texture unit 0, then puts the frame pipeline's state back. */
function withPassState(gl: WebGL2RenderingContext, work: () => void): void {
  const caps = CAPS.map((c) => [gl[c], gl.isEnabled(gl[c])] as const);
  const framebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;
  const vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null;
  const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
  const mask = gl.getParameter(gl.COLOR_WRITEMASK) as boolean[];
  const alignment = gl.getParameter(gl.UNPACK_ALIGNMENT) as number;
  const unit = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
  try {
    gl.activeTexture(gl.TEXTURE0);
    for (const [c] of caps) gl.disable(c);
    gl.bindVertexArray(null);
    gl.colorMask(true, true, true, true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    work();
  } finally {
    for (const [c, on] of caps) if (on) gl.enable(c);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.bindVertexArray(vao);
    gl.viewport(viewport[0]!, viewport[1]!, viewport[2]!, viewport[3]!);
    gl.colorMask(mask[0]!, mask[1]!, mask[2]!, mask[3]!);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
    gl.activeTexture(unit);
  }
}

/** An empty volume: an RGBA8 3D texture of `size`³ with room for its mip chain, LINEAR, REPEAT on all three axes. */
function volumeTexture(gl: WebGL2RenderingContext, size: number): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.texStorage3D(gl.TEXTURE_3D, mipLevels(size), gl.RGBA8, size, size, size);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R])
    gl.texParameteri(gl.TEXTURE_3D, wrap, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_3D, null);
  return tex;
}

/** The mip chain of a volume: 2×2×2 box means, which keep a periodic volume periodic. */
function mipmap(gl: WebGL2RenderingContext, tex: WebGLTexture): void {
  gl.bindTexture(gl.TEXTURE_3D, tex);
  gl.generateMipmap(gl.TEXTURE_3D);
  gl.bindTexture(gl.TEXTURE_3D, null);
}

/**
 * Renders every slice of `tex` with the program of `key`/`fragment` through `fbo`, then its mip chain, and returns how
 * long that took once complete (the closing readPixels waits for it).
 */
function render(
  gl: WebGL2RenderingContext,
  key: string,
  fragment: string,
  tex: WebGLTexture,
  size: number,
  fbo: WebGLFramebuffer,
  probe: Uint8Array,
): number {
  const t = performance.now();
  const p = program(gl, key, fragment);
  gl.useProgram(p);
  gl.uniform1f(loc(gl, p, "uSize"), size);
  const slice = loc(gl, p, "uSlice");
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, size, size);
  // The texture is never bound to a unit while it is the render target.
  for (let z = 0; z < size; z++) {
    gl.uniform1f(slice, z);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, z);
    if (z === 0 && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
      throw new Error("[vol] noise: the slice framebuffer is incomplete");
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  mipmap(gl, tex);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe);
  return performance.now() - t;
}

function blueTexture(gl: WebGL2RenderingContext, pixels: Uint8Array): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, BLUE_SIZE, BLUE_SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, pixels);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/** Builds and times the three textures of `tier`. */
function generate(gl: WebGL2RenderingContext, tier: QualityTier): Noise {
  const { shapeSize, detailSize } = TIERS[tier];
  const t0 = performance.now();
  const shapeSource = `shape${shapeSize}`;
  const detailSource = "detail";
  // Both shaders first: a compile the first time a browser sees them, a cache lookup after.
  const tLink = performance.now();
  program(gl, shapeSource, shapeFragment(shapeSize));
  program(gl, detailSource, detailFragment());
  const linkMs = performance.now() - tLink;
  const tBlue = performance.now();
  const blue = blueTexture(gl, blueNoise());
  const blueMs = performance.now() - tBlue;
  const probe = new Uint8Array(4);
  let shapeMs = 0;
  let detailMs = 0;
  const made: WebGLTexture[] = [blue];
  const fbo = gl.createFramebuffer()!;
  let shape!: WebGLTexture;
  let detail!: WebGLTexture;
  try {
    withPassState(gl, () => {
      shape = volumeTexture(gl, shapeSize);
      made.push(shape);
      shapeMs = render(gl, shapeSource, shapeFragment(shapeSize), shape, shapeSize, fbo, probe);
      detail = volumeTexture(gl, detailSize);
      made.push(detail);
      detailMs = render(gl, detailSource, detailFragment(), detail, detailSize, fbo, probe);
    });
  } catch (e) {
    made.forEach((t) => gl.deleteTexture(t));
    throw e;
  } finally {
    gl.deleteFramebuffer(fbo);
  }
  const genMs = performance.now() - t0;
  const ms = (n: number): string => `${n.toFixed(1)} ms`;
  console.info(
    `[vol] noise ${tier}: SHAPE ${shapeSize}³ ${ms(shapeMs)}, DETAIL ${ms(detailMs)}, BLUE ${ms(blueMs)}, shaders ${ms(linkMs)} → ${ms(genMs)} (budget ${GENERATION_BUDGET_MS} ms)`,
  );
  if (genMs >= GENERATION_BUDGET_MS)
    console.warn(`[vol] noise took ${ms(genMs)}: over the ${GENERATION_BUDGET_MS} ms budget`);
  return { shape, detail, blue, shapeSize, genMs };
}

/** Runs `work` in a later task, so a run asked for during a frame's turn doesn't block that frame. */
function later(work: () => Noise, fail: () => void): Promise<Noise> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(work());
      } catch (e) {
        fail();
        reject(e);
      }
    }, 0),
  );
}

export const createNoiseTextures: CreateNoiseTextures = async (gl, tier) => {
  registerDebugView("noise", noiseView);
  let tiers = cache.get(gl);
  if (!tiers) cache.set(gl, (tiers = new Map()));
  let entry = tiers.get(tier);
  if (!entry) {
    const own = tiers;
    entry = {
      refs: 0,
      run: later(
        () => generate(gl, tier),
        () => own.delete(tier),
      ),
    };
    tiers.set(tier, entry);
  }
  const shared = entry;
  shared.refs++;
  const noise = await shared.run;
  let live = true;
  return {
    ...noise,
    dispose() {
      if (!live) return;
      live = false;
      // Another handle may still own this run (a second renderer on the same context).
      if (--shared.refs > 0) return;
      if (tiers!.get(tier) === shared) tiers!.delete(tier);
      [noise.shape, noise.detail, noise.blue].forEach((t) => gl.deleteTexture(t));
    },
  };
};

// ── ?debug=noise ──────────────────────────────────────────────────────────────────────────────────────────────────

/** --ink, the backdrop around the tiles, as the canvas shows it (the fallback is its current value). */
function ink(): Vec3 {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (!hex) return [0x0b / 255, 0x12 / 255, 0x20 / 255];
  const n = Number.parseInt(hex[1]!, 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The viewer's state across mounts: the slice on the slider, and the backdrop colour. */
const view = { z: 0.5, ink: [0x0b / 255, 0x12 / 255, 0x20 / 255] as Vec3 };

/** The mounted UI's captions, and the layout they were last placed at. Owned by the newest mount. */
let mounted: { captions: HTMLElement[]; placed: string } | null = null;

/** Moves the captions onto the tiles when the layout changes. */
function placeCaptions(layout: SliceLayout, scale: number): void {
  const m = mounted;
  if (!m) return;
  const key = `${scale}:${layout.caption}:${layout.tiles.map((t) => `${t.x},${t.y},${t.size}`).join(";")}`;
  if (key === m.placed) return;
  m.placed = key;
  layout.tiles.forEach((t, i) => {
    const el = m.captions[i]!;
    el.hidden = t.size === 0;
    el.style.left = `${t.x / scale}px`;
    el.style.top = `${(t.y - layout.caption) / scale}px`;
    el.style.width = `${t.size / scale}px`;
    el.style.height = `${layout.caption / scale}px`;
  });
}

const noiseView: DebugView = {
  draw(ctx) {
    const { gl, width, height } = ctx;
    const p = ctx.program("noise", SLICE_VIEW_MAIN);
    const scale = width / ((gl.canvas as HTMLCanvasElement).clientWidth || width);
    const blend = gl.isEnabled(gl.BLEND);
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    // Binds uShape, uDetail and uBlue (and uWeather) to their units.
    ctx.apply(p);
    const layout = sliceLayout(width, height, scale);
    gl.uniform4fv(loc(gl, p, "uNzTiles"), layout.uv);
    gl.uniform1f(loc(gl, p, "uNzZ"), view.z);
    gl.uniform3fv(loc(gl, p, "uNzInk"), view.ink);
    ctx.fullscreen();
    if (scissor) gl.enable(gl.SCISSOR_TEST);
    if (blend) gl.enable(gl.BLEND);
    placeCaptions(layout, scale);
  },
  mount(host) {
    view.ink = ink();
    const bar = document.createElement("div");
    bar.className = "absolute inset-x-0 bottom-4 flex justify-center";
    const label = document.createElement("label");
    label.className =
      "flex items-center gap-3 rounded-lg border border-hairline bg-ink px-3 py-2 font-mono text-xs text-text";
    const name = document.createElement("span");
    name.textContent = "z";
    name.className = "text-graphite";
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "1";
    input.step = "0.001";
    input.value = String(view.z);
    input.setAttribute("aria-label", "Slice z");
    input.className = "w-40 [accent-color:var(--text)]";
    const readout = document.createElement("output");
    readout.className = "w-10 text-right tabular-nums";
    const show = (): void => {
      readout.textContent = Number(input.value).toFixed(3);
    };
    input.addEventListener("input", () => {
      view.z = Number(input.value);
      show();
    });
    show();
    label.append(name, input, readout);
    bar.append(label);
    const captions = SLICE_TILES.map((text) => {
      const el = document.createElement("span");
      el.textContent = text;
      el.className = "pointer-events-none absolute flex items-end font-mono text-xs text-graphite";
      return el;
    });
    host.append(bar, ...captions);
    const own = { captions, placed: "" };
    mounted = own;
    return () => {
      bar.remove();
      captions.forEach((el) => el.remove());
      // A newer mount may already own the viewer (dev's StrictMode mounts the second renderer before the first unmounts).
      if (mounted === own) mounted = null;
    };
  },
};
