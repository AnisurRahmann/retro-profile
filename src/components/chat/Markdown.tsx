import type { ReactNode } from "react";

/**
 * Tiny, safe markdown for agent replies: paragraphs, **bold**, lists and links.
 * No raw HTML ever (React escapes text). Links render only for https URLs on allowlisted hosts;
 * anything else renders as its plain text.
 */

export function safeHref(url: string, allowedHosts: string[]): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return allowedHosts.includes(u.host) ? u.toString() : null;
  } catch {
    return null;
  }
}

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)|(https:\/\/[^\s)<>"']+[^\s)<>"'.,;:!?])/g;

export function renderInlineMd(text: string, allowedHosts: string[], keyPrefix = ""): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    const start = m.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const key = `${keyPrefix}${i++}`;
    if (m[1] !== undefined) {
      out.push(
        <strong key={key} className="font-medium text-text">
          {m[1]}
        </strong>,
      );
    } else {
      const label = m[2] ?? m[4]!;
      const href = safeHref(m[3] ?? m[4]!, allowedHosts);
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noopener" className="underline decoration-hairline underline-offset-4 hover:decoration-text">
            {label}
          </a>
        ) : (
          <span key={key}>{label}</span>
        ),
      );
    }
    last = start + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] };

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const lines = chunk.split("\n").filter((l) => l.trim() !== "");
    let para: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
      para = [];
    };
    for (const line of lines) {
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      const kind = bullet ? "ul" : numbered ? "ol" : null;
      if (kind) {
        flush();
        const prev = blocks.at(-1);
        const item = (bullet ?? numbered)![1]!;
        if (prev && prev.kind === kind) prev.items.push(item);
        else blocks.push({ kind, items: [item] });
      } else {
        para.push(line.trim().replace(/^#+\s*/, ""));
      }
    }
    flush();
  }
  return blocks;
}

export function Markdown({ text, allowedHosts }: { text: string; allowedHosts: string[] }) {
  return (
    <>
      {parseBlocks(text).map((b, i) => {
        if (b.kind === "p") {
          return (
            <p key={i} className="[&+*]:mt-3">
              {renderInlineMd(b.text, allowedHosts, `${i}-`)}
            </p>
          );
        }
        const List = b.kind;
        return (
          <List key={i} className={`${b.kind === "ul" ? "list-disc" : "list-decimal"} space-y-1 pl-5 marker:text-graphite [&+*]:mt-3`}>
            {b.items.map((item, j) => (
              <li key={j}>{renderInlineMd(item, allowedHosts, `${i}-${j}-`)}</li>
            ))}
          </List>
        );
      })}
    </>
  );
}
