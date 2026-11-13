import { ui } from "@/content";

/** Section header styled as a meet scoreboard row: flight number, name with its plain label, count. */
export function ScoreRow({
  n,
  name,
  plain,
  count,
  headingId,
  sub = false,
  level,
}: {
  n?: string;
  name: string;
  plain: string;
  count: string;
  headingId: string;
  sub?: boolean;
  /** heading level, defaults to h2 for a flight and h3 for a sub row */
  level?: 1 | 2 | 3;
}) {
  const Heading = `h${level ?? (sub ? 3 : 2)}` as "h1" | "h2" | "h3";
  return (
    <header className={sub ? "scorerow scorerow-sub" : "scorerow"}>
      <span className="scorerow-n">{n ? `${ui.flight} ${n}` : plain}</span>
      <span className="scorerow-count">{count}</span>
      <Heading id={headingId} className="scorerow-name">
        {name}
        {n ? <span className="plain">{plain}</span> : null}
      </Heading>
    </header>
  );
}

export function Knurl() {
  return <div className="knurl" role="presentation" />;
}
