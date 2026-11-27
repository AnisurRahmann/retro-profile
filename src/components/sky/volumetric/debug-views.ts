/**
 * The registry of JS debug views (owner T0). A task registers its view from its own module, at import time or when
 * its factory runs; renderer.ts shows it for ?debug=<name> instead of the pipeline. See DebugView in types.ts.
 */
import type { DebugContext, DebugView } from "./types";

const views = new Map<string, DebugView>();

export function registerDebugView(name: string, view: DebugView | ((ctx: DebugContext) => void)): void {
  views.set(name, typeof view === "function" ? { draw: view } : view);
}

export const debugView = (name: string): DebugView | undefined => views.get(name);
