"use client";

import { useEffect, useRef, useState } from "react";
import { emitSignal, onSignal } from "@/lib/signal-bus";
import { EmitterRing, SF, smoothToward } from "@/lib/signal-math";
import { FRAG, VERT } from "./shader";

declare global {
  interface Window {
    __signalFrames?: number;
    __emitSignal?: typeof emitSignal;
  }
}

const TEST = process.env.NEXT_PUBLIC_E2E === "1";
const DEV = process.env.NODE_ENV === "development";
const UNIFORMS = ["uRes", "uDpr", "uT", "uGain", "uVw", "uCols", "uC", "uE", "uE0", "uG", "uX", "uS"] as const;
const NO_EMITTERS = new Float32Array(SF.maxEmitters).fill(-1e6);

/** Reads a colour token (#rrggbb or rgb()) from :root as linear-ish 0..1 floats (sRGB, as the page paints). */
function token(name: string): [number, number, number] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (v.startsWith("#")) {
    const n = parseInt(v.slice(1, 7), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const [r = 0, g = 0, b = 0] = (v.match(/[\d.]+/g) ?? []).map(Number);
  return [r / 255, g / 255, b / 255];
}

const nextTask = (ms = 0) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Starts the field; returns a disposer. Setup is split across tasks so no step is a long task. */
function start(canvas: HTMLCanvasElement, fallback: () => void): () => void {
  let dead = false;
  let dispose: (() => void) | null = null;
  void setup(canvas, fallback, () => dead).then((d) => {
    if (dead) d?.();
    else dispose = d;
  });
  return () => {
    dead = true;
    dispose?.();
  };
}

async function setup(canvas: HTMLCanvasElement, fallback: () => void, isDead: () => boolean): Promise<(() => void) | null> {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) {
    fallback();
    return null;
  }
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  await nextTask();

  let u = {} as Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
  const build = async (): Promise<boolean> => {
    const prog = gl.createProgram();
    for (const [type, src] of [
      [gl.VERTEX_SHADER, VERT],
      [gl.FRAGMENT_SHADER, FRAG],
    ] as const) {
      const s = gl.createShader(type);
      if (!s) return false;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog);
    // Don't block the main thread on the compile: poll the parallel-compile status between tasks.
    if (parallel) while (!gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) await nextTask(32);
    else await nextTask();
    if (isDead() || !gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    u = Object.fromEntries(UNIFORMS.map((n) => [n, gl.getUniformLocation(prog, n)])) as typeof u;
    gl.uniform3fv(u.uG, token("--graphite"));
    gl.uniform3fv(u.uX, token("--text"));
    gl.uniform3fv(u.uS, token("--signal"));
    gl.bindVertexArray(gl.createVertexArray());
    gl.clearColor(0, 0, 0, 0);
    return true;
  };
  if (!(await build())) {
    if (!isDead()) fallback();
    return null;
  }
  await nextTask();
  if (isDead()) return null;

  const ring = new EmitterRing();
  const origin = performance.now();
  const now = () => (performance.now() - origin) / 1000;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");

  let dpr = 1;
  let vw = 0;
  let cols = 0;
  let rows = 0;
  let tx = -1e4,
    ty = -1e4,
    cx = -1e4,
    cy = -1e4,
    gain = 0,
    gainTarget = 0,
    lastMove = -1e9;
  let raf = 0,
    running = false,
    lastDraw = 0,
    drawn = false;
  let hidden = document.hidden,
    visible = true,
    lost = false,
    reduce = motion.matches;

  // Dev-only GPU timing.
  const timer = DEV ? gl.getExtension("EXT_disjoint_timer_query_webgl2") : null;
  let query: WebGLQuery | null = null;
  const samples: number[] = [];
  if (DEV && !timer) console.info("[signal-field] EXT_disjoint_timer_query_webgl2 unavailable");

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    cols = Math.ceil(vw / SF.pitch) + 1;
    rows = Math.ceil(canvas.clientHeight / SF.pitch) + 1;
  };

  const pollTimer = () => {
    if (!timer || !query || !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
    if (!gl.getParameter(timer.GPU_DISJOINT_EXT)) samples.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
    gl.deleteQuery(query);
    query = null;
    if (samples.length >= 60) {
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      console.info(`[signal-field] GPU ${avg.toFixed(3)} ms/frame at ${canvas.width}x${canvas.height}`);
      samples.length = 0;
    }
  };

  const draw = (t: number, still: boolean) => {
    pollTimer();
    const timing = timer && !query ? (query = gl.createQuery()) : null;
    if (timer && timing) gl.beginQuery(timer.TIME_ELAPSED_EXT, timing);
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uVw, vw);
    gl.uniform1f(u.uCols, cols);
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uGain, still ? 0 : gain);
    gl.uniform2f(u.uC, cx, cy);
    gl.uniform3fv(u.uE, ring.pos);
    gl.uniform1fv(u.uE0, still ? NO_EMITTERS : ring.t0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, cols * rows);
    if (timer && timing) gl.endQuery(timer.TIME_ELAPSED_EXT);
    if (TEST) window.__signalFrames = (window.__signalFrames ?? 0) + 1;
    if (!drawn) {
      drawn = true;
      canvas.style.opacity = "1";
    }
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    const t = now();
    const dt = Math.min(t - lastDraw, 0.1);
    const settling = Math.abs(gain - gainTarget) > 1e-3;
    const busy = ring.active(t) || t - lastMove < 2 || settling;
    const minDt = busy ? (coarse ? 1 / 30 : 0) : 1 / 15;
    if (dt < minDt - 0.004) return;
    cx = smoothToward(cx, tx, dt);
    cy = smoothToward(cy, ty, dt);
    gain = gainTarget > gain ? Math.min(gainTarget, gain + dt / SF.cursorFade) : Math.max(gainTarget, gain - dt / SF.cursorFade);
    draw(t, false);
    lastDraw = t;
  };

  const sync = () => {
    const go = !reduce && !hidden && visible && !lost;
    if (go && !running) {
      running = true;
      lastDraw = now();
      raf = requestAnimationFrame(loop);
    } else if (!go && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  };
  const still = () => {
    if (!lost) draw(0, true);
  };

  // Bus and pointer wiring (not under reduced motion).
  let unsub: (() => void) | null = null;
  const onMove = (e: PointerEvent) => {
    tx = e.clientX;
    ty = e.clientY;
    if (gain === 0 && gainTarget === 0) {
      cx = tx;
      cy = ty;
    }
    gainTarget = 1;
    lastMove = now();
  };
  const onOut = (e: PointerEvent) => {
    if (!e.relatedTarget) gainTarget = 0;
  };
  const onDown = (e: PointerEvent) => emitSignal({ x: e.clientX, y: e.clientY, amp: 0.6 });
  const subscribe = () => {
    if (unsub) return;
    const off = onSignal((s) => ring.push(s.x, s.y, s.amp, now()));
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    unsub = () => {
      off();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown);
      unsub = null;
    };
  };

  const applyMotion = () => {
    reduce = motion.matches;
    if (reduce) {
      unsub?.();
      sync();
      still();
    } else {
      subscribe();
      sync();
    }
  };
  const onVisibility = () => {
    hidden = document.hidden;
    sync();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
    sync();
  };
  const onRestored = () => {
    void build().then((ok) => {
      if (!ok) return fallback();
      lost = false;
      resize();
      if (reduce) still();
      else sync();
    });
  };

  let resizeTimer = 0;
  const ro = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const w = canvas.width;
      const h = canvas.height;
      resize();
      if (reduce && (w !== canvas.width || h !== canvas.height)) still();
    }, 100);
  });
  const io = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    sync();
  });

  resize();
  ro.observe(canvas);
  io.observe(canvas);
  motion.addEventListener("change", applyMotion);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  if (TEST) window.__emitSignal = emitSignal;
  applyMotion();

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    unsub?.();
    ro.disconnect();
    io.disconnect();
    window.clearTimeout(resizeTimer);
    motion.removeEventListener("change", applyMotion);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onLost);
    canvas.removeEventListener("webglcontextrestored", onRestored);
  };
}

/** Interactive dot-grid background. Mounted once in the root layout via next/dynamic (ssr: false). */
export default function SignalField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [css, setCss] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stop: () => void = () => {};
    let done = false;
    const run = () => {
      if (!done) stop = start(canvas, () => setCss(true));
    };
    const idle = "requestIdleCallback" in window;
    const id = idle ? window.requestIdleCallback(run, { timeout: 2000 }) : window.setTimeout(run, 200);
    return () => {
      done = true;
      if (idle) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
      stop();
    };
  }, []);

  if (css) return <div aria-hidden="true" className="signal-fallback" data-signal-fallback="" />;
  return <canvas ref={ref} aria-hidden="true" className="signal-canvas" data-signal-field="" />;
}
