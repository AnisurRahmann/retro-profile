import Image from "next/image";
import type { Receipt } from "@/content.schema";
import { renderInline } from "@/lib/inline";
import { ui } from "@/site";
import { Tile } from "./Tile";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const meta = [receipt.channel, receipt.org, receipt.date].filter(Boolean).join(" · ");
  const bot = receipt.kind === "app";
  const avatar = bot ? (
    <Tile id={receipt.id} title={receipt.author} small />
  ) : receipt.avatar ? (
    <Image
      src={receipt.avatar.replace(/^public/, "")}
      alt=""
      width={28}
      height={28}
      className="size-7 flex-none rounded-md object-cover"
    />
  ) : (
    <span aria-hidden="true" className="tile tile--sm bg-surface-2">
      {initials(receipt.author)}
    </span>
  );

  const body = (
    <p className="mt-1.5 text-sm leading-[22px] text-text">{renderInline(receipt.body)}</p>
  );

  return (
    <article className="rounded-lg bg-surface px-4 py-3.5">
      <p className="font-mono text-xs text-graphite">{meta}</p>
      <div className="mt-2.5 flex gap-2.5">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 leading-5">
            <span className="text-sm font-medium text-text">{receipt.author}</span>
            {bot ? (
              <span className="rounded-[3px] bg-surface-2 px-1 font-mono text-[10px] leading-4 text-graphite">
                {ui.home.appBadge}
              </span>
            ) : null}
            {receipt.org ? (
              <span className="rounded-[3px] border border-hairline px-1 font-mono text-[10px] leading-4 text-graphite uppercase">
                {receipt.org}
              </span>
            ) : null}
            {receipt.time ? <span className="font-mono text-xs text-graphite">{receipt.time}</span> : null}
          </div>
          {receipt.href ? (
            <a href={receipt.href} target="_blank" rel="noopener" className="block hover:underline">
              {body}
            </a>
          ) : (
            body
          )}
          {receipt.reactions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {receipt.reactions.map((r) => (
                <span
                  key={r.emoji}
                  className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-2 px-2 py-0.5 font-mono text-xs text-graphite"
                >
                  <span aria-hidden="true">{r.emoji}</span>
                  {r.count}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
