/** WebGL2 atmosphere layer. Returns null when WebGL2 or the shader is unavailable (the CSS gradient stays). */
import { NOISE_SIZE, cellData, noiseData } from "@/lib/sky/clouds";
import { FRAG, VERT } from "./sky-shader";

/** Uniform values by GLSL name: numbers → float, [x, y] → vec2, [r, g, b] → vec3, [x, y, z, w] → vec4. */
export type Uniforms = Record<string, number | number[]>;

export type Atmosphere = {
  resize(): void;
  draw(u: Uniforms): void;
  /** Rebuild after a restored context. */
  restore(): Promise<boolean>;
};

/** Atmosphere backing scale, × DPR. */
export const ATMOSPHERE_SCALE = 0.4;

/**
 * The sky's debug flag (store.ts SKY_DEBUG), written out again here on purpose: a constant of the module that uses
 * it is folded away in a release build, an imported one or a parameter is not, and then the code it guards ships.
 */
const DEBUG = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SKY_DEBUG === "1" || process.env.NEXT_PUBLIC_E2E === "1";

const nextTask = (ms = 0) => new Promise<void>((r) => window.setTimeout(r, ms));

export async function createAtmosphere(canvas: HTMLCanvasElement, isDead: () => boolean): Promise<Atmosphere | null> {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  // Debug builds only: GPU timing via EXT_disjoint_timer_query_webgl2, and ?skyscale= to compare backing scales.
  const timer = DEBUG ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
  const qScale = DEBUG ? Number(new URLSearchParams(location.search).get("skyscale")) : 0;
  let prog: WebGLProgram;
  const loc = new Map<string, WebGLUniformLocation | null>();
  let scale = 1;
  let query: WebGLQuery | null = null;
  const samples: number[] = [];

  const build = async (): Promise<boolean> => {
    prog = gl.createProgram();
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (DEBUG && !gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn("[sky] shader:", gl.getShaderInfoLog(s));
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    // Never block the main thread on the compile: poll between tasks.
    if (parallel) while (!gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) await nextTask(32);
    else await nextTask();
    if (isDead() || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (DEBUG && !isDead()) console.warn("[sky] shader:", gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    loc.clear();
    gl.bindVertexArray(gl.createVertexArray());
    // The noise textures (src/lib/sky/clouds.ts): four value-noise lattices, and the Worley cells. Seeded, so the
    // cloud field is the same on every load; one filtered fetch per lookup instead of four hashes.
    for (const [unit, name, data] of [
      [0, "uNoise", noiseData()],
      [1, "uCells", cellData()],
    ] as const) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, NOISE_SIZE, NOISE_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      for (const [k, v] of [
        [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
        [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
        [gl.TEXTURE_WRAP_S, gl.REPEAT],
        [gl.TEXTURE_WRAP_T, gl.REPEAT],
      ]) gl.texParameteri(gl.TEXTURE_2D, k!, v!);
      gl.uniform1i(gl.getUniformLocation(prog, name), unit);
    }
    return true;
  };
  if (!(await build())) return null;

  const resize = () => {
    // Backing store at 0.4 × DPR (brief: 0.5, lowered to meet the 2 ms GPU budget; DECISIONS #83). Everything in
    // this layer is soft and upscales cleanly.
    scale = (qScale > 0 && qScale <= 2 ? qScale : ATMOSPHERE_SCALE) * (devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  return {
    resize,
    async restore() {
      const ok = await build();
      if (ok) resize();
      return ok;
    },
    draw(u) {
      if (timer && query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
        if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(query);
        query = null;
        if (samples.length >= 60) {
          const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
          console.info(`[sky] GPU ${avg.toFixed(3)} ms/frame at ${canvas.width}x${canvas.height}`);
          samples.length = 0;
        }
      }
      const q = timer && !query ? (query = gl.createQuery()) : null;
      if (timer && q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
      u.uRes = [canvas.width, canvas.height];
      u.uScale = scale;
      for (const k in u) {
        if (!loc.has(k)) loc.set(k, gl.getUniformLocation(prog, k));
        const l = loc.get(k)!;
        const v = u[k]!;
        if (typeof v === "number") gl.uniform1f(l, v);
        else if (v.length === 2) gl.uniform2fv(l, v);
        else if (v.length === 4) gl.uniform4fv(l, v);
        else gl.uniform3fv(l, v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (timer && q) gl.endQuery(timer.TIME_ELAPSED_EXT);
    },
  };
}
