import { SkyController } from "./SkyController";
import { SkyMount } from "./SkyMount";

/** The Sylhet Sky background stack (fixed, aria-hidden, pointer-events none). See CLAUDE.md. */
export function SkyBackdrop() {
  return (
    <>
      <div aria-hidden="true" className="sky-layer sky-gradient" data-sky-gradient="" />
      <SkyController />
      <SkyMount />
      <div aria-hidden="true" className="sky-scrim" data-sky-scrim="">
        <div className="sky-scrim-ramp" data-sky-scrim-ramp="">
          <div className="sky-scrim-fill" />
        </div>
      </div>
      <div aria-hidden="true" className="grain" />
    </>
  );
}
