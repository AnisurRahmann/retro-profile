"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme and redline preferences live on <html> as data attributes (set before
 * hydration by the inline script in layout.tsx) and are mirrored to localStorage.
 */
export type Theme = "paper" | "blueprint";
export type Redlines = "on" | "off";

const EVENT = "ds:prefs";
export const STORAGE = { theme: "ds-theme", redlines: "ds-redlines" } as const;

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

function save(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode, blocked). The toggle still works for this visit.
  }
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === "blueprint" ? "blueprint" : "paper";
}

export function getRedlines(): Redlines {
  return document.documentElement.dataset.redlines === "off" ? "off" : "on";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  save(STORAGE.theme, theme);
  window.dispatchEvent(new Event(EVENT));
}

export function setRedlines(value: Redlines): void {
  document.documentElement.dataset.redlines = value;
  save(STORAGE.redlines, value);
  window.dispatchEvent(new Event(EVENT));
}

export const toggleTheme = () => setTheme(getTheme() === "paper" ? "blueprint" : "paper");
export const toggleRedlines = () => setRedlines(getRedlines() === "on" ? "off" : "on");

export function useTheme(): Theme {
  return useSyncExternalStore<Theme>(subscribe, getTheme, () => "paper");
}

export function useRedlines(): Redlines {
  return useSyncExternalStore<Redlines>(subscribe, getRedlines, () => "on");
}

export { subscribe as subscribePrefs };
