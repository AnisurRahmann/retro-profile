/**
 * The sky stage: the top of the home page, full-bleed, where nothing covers the sky. The hero sits at its bottom,
 * in the column; the top is open sky. Its bottom edge is where the column scrim starts (src/lib/sky/view.ts).
 */
export function SkyStage({ children }: { children: React.ReactNode }) {
  return (
    <section className="sky-stage section" data-sky-stage="">
      <div aria-hidden="true" className="sky-stage-open" data-sky-open="" />
      <div className="column">
        <div className="relative w-fit max-w-full" data-sky-hero="">
          <div aria-hidden="true" className="text-scrim hero-scrim" />
          <div className="relative">{children}</div>
        </div>
      </div>
    </section>
  );
}
