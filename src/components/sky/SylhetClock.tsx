"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { liveNow, skyStore } from "@/lib/sky/store";
import { formatHM, msToNextMinute } from "@/lib/sky/time";

const serverSnap = () => null;

/**
 * HH:mm in Sylhet. Server-renders "--:--" (no hydration mismatch), then ticks exactly on each minute boundary
 * and resyncs when the tab becomes visible again. Width is reserved by tabular figures in a fixed 5ch box.
 */
export function SylhetClock() {
  const override = useSyncExternalStore(skyStore.subscribe, () => skyStore.get().timeOverride, serverSnap);
  const [text, setText] = useState("--:--");

  useEffect(() => {
    let timer = 0;
    const tick = () => {
      window.clearTimeout(timer);
      setText(formatHM(liveNow()));
      if (!override) timer = window.setTimeout(tick, msToNextMinute(Date.now()));
    };
    const onVisibility = () => {
      if (document.hidden) window.clearTimeout(timer);
      else tick();
    };
    tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [override]);

  return (
    <time className="sky-clock" data-testid="sylhet-clock" suppressHydrationWarning>
      {text}
    </time>
  );
}
