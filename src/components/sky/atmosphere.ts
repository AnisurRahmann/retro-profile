/** WebGL2 atmosphere layer. Returns null when WebGL2 or the shader is unavailable (the CSS gradient stays). */
import { FRAG, VERT } from "./sky-shader";

/** Uniform values by GLSL name: numbers → float, [x, y] → vec2, [r, g, b] → vec3. */
export type Uniforms = Record<string, number | number[]>;

export type Atmosphere = {
  resize(): void;
  draw(u: Uniforms): void;
  /** Rebuild after a restored context. */
  restore(): Promise<boolean>;
};

const nextTask = (ms = 0) => new Promise<void>((r) => window.setTimeout(r, ms));

export async function createAtmosphere(canvas: HTMLCanvasElement, debug: boolean, isDead: () => boolean): Promise<Atmosphere | null> {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
  if (!gl) return null;
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  // Dev/test only: GPU timing via EXT_disjoint_timer_query_webgl2, and ?skyscale= to compare backing scales.
  const timer = debug ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
  const qScale = debug ? Number(new URLSearchParams(location.search).get("skyscale")) : 0;
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
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    // Never block the main thread on the compile: poll between tasks.
    if (parallel) while (!gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) await nextTask(32);
    else await nextTask();
    if (isDead() || !gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (debug && !isDead()) console.warn("[sky] shader:", gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);
    loc.clear();
    gl.bindVertexArray(gl.createVertexArray());
    return true;
  };
  if (!(await build())) return null;

  const resize = () => {
    // Backing store at 0.5 × DPR: everything in this layer is soft and upscales cleanly.
    scale = (qScale > 0 && qScale <= 2 ? qScale : 0.5) * (devicePixelRatio || 1);
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
        else gl.uniform3fv(l, v);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (timer && q) gl.endQuery(timer.TIME_ELAPSED_EXT);
    },
  };
}
