import Link from "next/link";
import { ui } from "@/site";

export default function NotFound() {
  return (
    <main className="column flex-1 pt-14">
      <h1 className="w-fit text-[36px] leading-10 font-medium tracking-[-0.02em] text-text" data-on-sky="h1">
        {ui.notFound.heading}
      </h1>
      <p className="mt-3 w-fit text-graphite" data-on-sky="body">
        {ui.notFound.body}
      </p>
      <Link href="/" className="mt-6 inline-block text-text underline underline-offset-4" data-on-sky="home">
        {ui.notFound.home}
      </Link>
    </main>
  );
}
