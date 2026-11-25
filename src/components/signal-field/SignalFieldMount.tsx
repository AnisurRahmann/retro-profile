"use client";

import dynamic from "next/dynamic";

const SignalField = dynamic(() => import("./SignalField"), { ssr: false });

export function SignalFieldMount() {
  return <SignalField />;
}
