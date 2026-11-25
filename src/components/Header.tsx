import Link from "next/link";
import { ui } from "@/site";

const navLink = "text-sm text-graphite transition-colors duration-150 hover:text-text";

export function Header() {
  return (
    <header className="column flex h-16 items-center justify-between">
      <Link href="/" aria-label={ui.nav.home} className="font-mono text-[15px] text-text">
        as
      </Link>
      <nav className="flex items-center gap-4 sm:gap-6">
        <Link href="/chat" className={navLink}>
          {ui.nav.chat}
        </Link>
        <Link href="/#shipped" className={navLink}>
          {ui.nav.work}
        </Link>
        <Link href="/lifts" className={navLink}>
          {ui.nav.lifts}
        </Link>
      </nav>
    </header>
  );
}
