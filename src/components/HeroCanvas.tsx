"use client";

import { useEffect, useRef } from "react";
import { subscribePrefs } from "@/lib/prefs";
import { pulses, tokenTicks, yAt } from "@/lib/trace";

/**
 * FIG. 1, animated. Draws over the server-rendered static trace and hides it.
 * Never mounted when the user prefers reduced motion (see HeroTraceLive).
 * Paused while the tab is hidden or the hero is off screen.
 */
export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const host = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !host || !ctx) return;

    let width = 0;
    let height = 0;
    let ink = "#10203a";
    let rule = "#c9c2b2";
    const readColors = () => {
      const cs = getComputedStyle(document.documentElement);
      ink = cs.getPropertyValue("--ink").trim() || ink;
      rule = cs.getPropertyValue("--rule").trim() || rule;
    };
    readColors();
    const unsubscribe = subscribePrefs(readColors);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Energy: cursor proximity on pointer devices, scroll velocity on touch.
    const BASE = 0.55;
    let target = BASE;
    let amp = BASE;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const rect = host.getBoundingClientRect();
      const dy = Math.abs(e.clientY - (rect.top + rect.height / 2));
      const dx =
        e.clientX < rect.left
          ? rect.left - e.clientX
          : e.clientX > rect.right
            ? e.clientX - rect.right
            : 0;
      const near = 1 - Math.min(1, Math.hypot(dx, dy) / 320);
      target = BASE + near * 0.85;
    };
    let lastY = window.scrollY;
    let lastT = performance.now();
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const onScroll = () => {
      if (!coarse) return;
      const now = performance.now();
      const v = Math.abs(window.scrollY - lastY) / Math.max(1, now - lastT);
      lastY = window.scrollY;
      lastT = now;
      target = Math.max(target, BASE + Math.min(1, v / 1.6) * 0.85);
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0;
    let running = false;
    let visible = true;
    let frames = 0;
    let spent = 0;
    const t0 = performance.now();

    const frame = (now: number) => {
      const started = performance.now();
      const t = (now - t0) / 1000;
      amp += (target - amp) * 0.08;
      if (coarse) target += (BASE - target) * 0.04;

      const mid = height / 2;
      const scale = height * 0.4;
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = rule;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, Math.round(mid) + 0.5);
      ctx.lineTo(width, Math.round(mid) + 0.5);
      ctx.stroke();

      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      for (let x = 0; x <= width; x += 2) {
        const y = mid - yAt(x / width, t, amp) * scale;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (const k of tokenTicks(t)) {
        const x = Math.round(k.u * width) + 0.5;
        ctx.moveTo(x, mid);
        ctx.lineTo(x, mid - k.h * scale);
      }
      ctx.stroke();

      // Pulses ride the wire (the baseline), not the signal.
      for (const u of pulses(t)) {
        ctx.fillRect(Math.round(u * width) - 5, Math.round(mid) - 1.5, 10, 4);
      }

      frames += 1;
      spent += performance.now() - started;
      if (frames % 30 === 0) canvas.dataset.frameMs = (spent / frames).toFixed(3);
      if (frames === 1) host.dataset.live = "1";
      raf = requestAnimationFrame(frame);
    };

    const sync = () => {
      const should = visible && !document.hidden;
      if (should && !running) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
      canvas.dataset.running = String(should);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      sync();
    });
    io.observe(host);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      unsubscribe();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", sync);
      delete host.dataset.live;
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" />;
}
