"use client";

import { useEffect, useState } from "react";
import { toggleRedlines, toggleTheme } from "@/lib/prefs";

/**
 * One small island for page-level behaviour:
 * - marks sheets as in view (once), which triggers the drafting animations in CSS
 * - tracks the current sheet for the margin tag and the sheet index
 * - keyboard shortcuts: 0 to 7, R, B
 */
export function Runtime({
  sheetNos,
  label,
  of,
}: {
  sheetNos: string[];
  label: string;
  of: string;
}) {
  const [current, setCurrent] = useState(sheetNos[0] ?? "00");

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-observe]"));
    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.setAttribute("data-inview", ""));
      return;
    }
    const seen = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-inview", "");
          seen.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0 },
    );
    const centre = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const no = (entry.target as HTMLElement).dataset.sheet;
          if (entry.isIntersecting && no) setCurrent(no);
        }
      },
      { rootMargin: "-45% 0px -54% 0px", threshold: 0 },
    );
    targets.forEach((el) => {
      seen.observe(el);
      if (el.dataset.sheet) centre.observe(el);
    });
    return () => {
      seen.disconnect();
      centre.disconnect();
    };
  }, []);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>("[data-sheet-link]").forEach((a) => {
      if (a.dataset.sheetLink === current) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }, [current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("[data-drawer]")) return;
      const key = e.key.toLowerCase();
      if (key === "r") toggleRedlines();
      else if (key === "b") toggleTheme();
      else if (sheetNos.includes(`0${key}`)) {
        const target = document.getElementById(`sheet-0${key}`);
        if (!target) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetNos]);

  const last = sheetNos[sheetNos.length - 1];
  return (
    <div className="sheet-tag" aria-hidden="true" data-current-sheet={current}>
      {label} {current} {of} {last}
    </div>
  );
}
