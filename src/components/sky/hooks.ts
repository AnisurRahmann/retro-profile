"use client";

import { useSyncExternalStore } from "react";
import { skyStore, type SkySnapshot } from "@/lib/sky/store";

/** "{time} in Sylhet" + { time: "07:52" } → "07:52 in Sylhet". */
export const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

const SERVER: SkySnapshot = skyStore.get();
export const useSky = () => useSyncExternalStore(skyStore.subscribe, skyStore.get, () => SERVER);
const noop = () => () => {};
/** false during SSR and hydration, true after: the page is static, so nothing time-dependent renders before. */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);
