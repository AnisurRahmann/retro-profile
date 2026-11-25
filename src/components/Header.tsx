import Link from "next/link";
import { ui } from "@/site";

const navLink = "text-sm text-graphite transition-colors duration-150 hover:text-text";

export function Header() {
  return (
    <header className="column relative z-10 flex h-16 items-center justify-between" data-sky-head="">
      <Link href="/" aria-label={ui.nav.home} className="font-mono text-[15px] text-text" data-on-sky="monogram">
        as
        <span aria-hidden="true" className="sky-dot" />
      </Link>
      <nav className="flex items-center gap-4 sm:gap-6">
        <Link href="/chat" className={navLink} data-on-sky="nav-chat">
          {ui.nav.chat}
        </Link>
        <Link href="/#shipped" className={navLink} data-on-sky="nav-work">
          {ui.nav.work}
        </Link>
        <Link href="/lifts" className={navLink} data-on-sky="nav-lifts">
          {ui.nav.lifts}
        </Link>
      </nav>
    </header>
  );
}
