import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import { profile } from "@/site";

const portraitExists = fs.existsSync(path.join(process.cwd(), "public", profile.portrait));

/** Round portrait with a 1px hairline ring. Falls back to the "as" monogram until public/shakil.jpg exists. */
export function Portrait({ size, priority = false }: { size: number; priority?: boolean }) {
  const style = { width: size, height: size };
  if (portraitExists) {
    return (
      <Image
        src={profile.portrait}
        alt={profile.name}
        width={size}
        height={size}
        priority={priority}
        className="flex-none rounded-full object-cover ring-1 ring-hairline"
        style={style}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={profile.name}
      className="grid flex-none place-items-center rounded-full bg-surface-2 font-mono text-graphite ring-1 ring-hairline"
      style={{ ...style, fontSize: Math.round(size * 0.3) }}
    >
      as
    </span>
  );
}
