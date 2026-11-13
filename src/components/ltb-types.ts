import type { LightState } from "@/schema";

/** Serializable view of a project for the Load the Bar game and the register (no content.ts import on the client). */
export type PlateData = {
  id: string;
  name: string;
  bus: string;
  busName: string;
  stamp: string;
  color: string;
  status: string;
  statusName: string;
  statusCall: string;
  statusPlain: string;
  statusRank: number;
  lights: [LightState, LightState, LightState];
  oneLiner: string;
  detail?: string;
  stack?: string[];
  install?: string[];
  version?: string;
  link?: { label: string; href: string };
  next?: string;
  connectsTo: string[];
};

export type Peg = { bus: string; name: string; color: string; ids: string[] };

export type LtbCopy = {
  rack: string;
  rackPlain: string;
  bar: string;
  barPlain: string;
  barAria: string;
  loaded: string;
  strip: string;
  stripPlain: string;
  onBar: string;
  emptyBar: string;
  emptyTitle: string;
  emptyHint: string;
  load: string;
  unload: string;
  loadedTag: string;
  stack: string;
  install: string;
  version: string;
  link: string;
  next: string;
  nextPlain: string;
  connects: string;
  inRegister: string;
  sizeLegend: string;
  sizeLegendPlain: string;
  colorLegend: string;
  colorLegendPlain: string;
  goodLift: string;
  goodLiftPlain: string;
  dropHint: string;
  announceLoaded: string;
  announceUnloaded: string;
  announceStripped: string;
};

export type LtbData = {
  plates: PlateData[];
  pegs: Peg[];
  sizes: { id: string; name: string; plain: string }[];
  shippedIds: string[];
  copy: LtbCopy;
};
