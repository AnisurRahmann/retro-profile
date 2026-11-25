import type { ReactNode } from "react";

/**
 * Receipt body renderer: "@Shakil" → mention chip, *word* → <em>. Plain text otherwise.
 */
export function renderInline(body: string): ReactNode[] {
  const parts = body.split(/(@Shakil\b|\*[^*\n]+\*)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    if (part === "@Shakil") {
      return (
        <span key={i} className="mention">
          @Shakil
        </span>
      );
    }
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={i} className="text-text">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
