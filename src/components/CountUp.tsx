"use client";

import { useEffect, useRef } from "react";
import type { Count } from "@/content.schema";
import { formatCount } from "@/lib/derive";

/**
 * Counts up once when scrolled into view. The server renders the final value,
 * so without JS or with reduced motion the number is simply there.
 */
export function CountUp({ count }: { count: Count }) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = formatCount(count);

  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let started = false;
    const run = () => {
      const t0 = performance.now();
      const dur = 900;
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - k, 3);
        el.textContent = formatCount(count, count.value * eased);
        if (k < 1) raf = requestAnimationFrame(step);
        else el.textContent = final;
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (!started && !entry.isIntersecting && entry.boundingClientRect.top > 0) {
          // Still below the fold: park at zero so the count starts from nothing.
          el.textContent = formatCount(count, 0);
        }
        if (entry.isIntersecting && !started) {
          started = true;
          io.disconnect();
          if (el.textContent !== final) run();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = final;
    };
  }, [count, final]);

  return (
    <>
      <span ref={ref} aria-hidden="true" data-final={final}>
        {final}
      </span>
      <span className="sr-only">{final}</span>
    </>
  );
}
