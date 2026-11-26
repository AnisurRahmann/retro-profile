import { SkyController } from "./SkyController";
import { SkyFallbackStars } from "./SkyFallback";
import { SkyMount } from "./SkyMount";

/** The Sylhet Sky background stack (fixed, aria-hidden, pointer-events none). See CLAUDE.md. */
export function SkyBackdrop() {
  return (
    <>
      <div aria-hidden="true" className="sky-layer sky-gradient" data-sky-gradient="" />
      {/* First-paint fallback (v5.1 T8): stars at night until the particle canvas has drawn. */}
      <SkyFallbackStars />
      <SkyController />
      <SkyMount />
      <div aria-hidden="true" className="grain" />
    </>
  );
}
