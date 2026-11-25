import Link from "next/link";
import { closer, links, ui } from "@/site";

export const buttonPrimary =
  "inline-flex h-10 items-center justify-center rounded-lg bg-text px-4 text-sm font-medium text-ink transition-opacity duration-150 hover:opacity-90";
export const buttonSecondary =
  "inline-flex h-10 items-center justify-center rounded-lg border border-hairline px-4 text-sm font-medium text-text transition-colors duration-150 hover:bg-surface-2";

export function Closer() {
  return (
    <section
      id="closer"
      aria-labelledby="closer-heading"
      className="section rounded-[10px] glass border border-hairline p-7 shadow-[inset_0_1px_0_var(--highlight)]"
    >
      <h2 id="closer-heading" className="text-[22px] leading-7 font-medium text-text">
        {closer.heading}
      </h2>
      <p className="mt-3 max-w-[46ch] text-base text-graphite">{closer.body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href={links.calendar} target="_blank" rel="noopener" className={buttonPrimary} data-sky-takeoff="">
          {ui.home.bookCta}
        </a>
        <Link href="/chat" className={buttonSecondary}>
          {ui.home.chatCta}
        </Link>
      </div>
    </section>
  );
}
