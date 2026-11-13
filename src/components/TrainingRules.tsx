import { principles, stack, tiers, ui } from "@/content";
import { GYM_RULES } from "@/gym";
import { counts, flight } from "@/lib/derive";
import { ScoreRow } from "./ScoreRow";

const TIER_SIZES = ["shipped", "in-build", "idea"] as const;

function RuleColumn({ title, plain, rules }: { title: string; plain: string; rules: { rule: string; detail: string | null }[] }) {
  return (
    <div className="panel">
      <h3 className="display flex flex-wrap items-baseline gap-x-3 border-b-2 border-iron p-4 text-4xl">
        {title} <span className="plain">{plain}</span>
      </h3>
      <ol>
        {rules.map((entry, index) => (
          <li key={entry.rule} className="flex gap-4 border-b border-knurl p-4 last:border-b-0">
            <span className="display steel w-8 flex-none text-3xl">{String(index + 1).padStart(2, "0")}</span>
            <span>
              <span className="block font-semibold">{entry.rule}</span>
              {entry.detail ? <span className="steel mt-1 block">{entry.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function TrainingRules() {
  const f = flight("training-rules");
  const t = ui.rules;
  return (
    <section id={f.id} className="flight wrap" aria-labelledby="h-training-rules">
      <ScoreRow
        n={f.n}
        name={f.name}
        plain={f.plain}
        count={`${counts.rules} ${ui.counts.rules}`}
        headingId="h-training-rules"
      />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RuleColumn title={t.gym} plain={t.gymPlain} rules={GYM_RULES.map((rule) => ({ rule, detail: null }))} />
        <RuleColumn title={t.production} plain={t.productionPlain} rules={principles} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <h3 className="label">
            <b>{t.tiers}</b> <span className="plain">{t.tiersPlain}</span>
          </h3>
          <ol className="mt-4 grid gap-4">
            {tiers.map((tier, index) => (
              <li key={tier.tier} className="flex items-center gap-4">
                <span className="flex w-24 flex-none justify-center">
                  <span className="plate plate-neutral" data-size={TIER_SIZES[index]} aria-hidden="true">
                    <span className="plate-id">{index + 1}</span>
                    <span className="plate-hole" />
                    <span className="plate-stamp" />
                  </span>
                </span>
                <span>
                  <span className="display block text-2xl">
                    {tier.tier} · {tier.share}
                  </span>
                  <span className="block">{tier.models}</span>
                  {tier.jobs ? <span className="mono steel block">{tier.jobs}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="panel p-4">
          <h3 className="label">
            <b>{t.stack}</b> <span className="plain">{t.stackPlain}</span>
          </h3>
          <ul className="mono mt-4 flex flex-wrap gap-2">
            {stack.map((item) => (
              <li key={item} className="border-2 border-iron bg-chalk px-2 py-1">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
