import { ui } from "@/content";

/** Section header styled as a meet scoreboard row: flight number, name with its plain label, count. */
export function ScoreRow({
  n,
  name,
  plain,
  count,
  headingId,
  sub = false,
}: {
  n?: string;
  name: string;
  plain: string;
  count: string;
  headingId: string;
  sub?: boolean;
}) {
  const Heading = sub ? "h3" : "h2";
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
