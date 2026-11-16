"use client";

import { useMemo, useSyncExternalStore } from "react";

const everySecond = (onChange: () => void) => {
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
};

/**
 * The time in one zone as text. The server (and the first client render) shows the placeholder,
 * so the markup matches on hydration. After that it follows the clock.
 */
export function DhakaClock({ timeZone, placeholder }: { timeZone: string; placeholder: string }) {
  const format = useMemo(() => new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }), [timeZone]);
  const time = useSyncExternalStore(
    everySecond,
    () => format.format(new Date()),
    () => placeholder,
  );
  return <span data-clock="">{time}</span>;
}
