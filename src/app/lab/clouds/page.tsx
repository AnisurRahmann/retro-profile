import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LAB_ENABLED } from "@/lib/sky/volumetric/gate";
import { LabClient } from "./LabClient";

/** /lab/clouds: the volumetric clouds lab (docs/volumetric/BRIEF.md). Dev and test builds only (gate.ts). */
export const metadata: Metadata = { title: "Clouds lab", robots: { index: false, follow: false } };

export default function CloudsLab() {
  if (!LAB_ENABLED) notFound();
  return <LabClient />;
}
