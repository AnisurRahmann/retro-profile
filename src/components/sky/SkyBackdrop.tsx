import { SkyController } from "./SkyController";

/** The Sylhet Sky background stack (fixed, aria-hidden, pointer-events none). See CLAUDE.md. */
export function SkyBackdrop() {
  return (
    <>
      <div aria-hidden="true" className="sky-layer sky-gradient" data-sky-gradient="" />
      <SkyController />
      <div aria-hidden="true" className="grain" />
    </>
  );
}
