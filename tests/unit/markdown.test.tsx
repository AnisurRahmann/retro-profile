import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown, parseBlocks, safeHref } from "@/components/chat/Markdown";
import { allowedLinkHosts } from "@/site";

const html = (t: string) => renderToStaticMarkup(<Markdown text={t} allowedHosts={allowedLinkHosts} />);

describe("chat markdown renderer", () => {
  it("only links https URLs on allowlisted hosts", () => {
    expect(safeHref("https://cal.com/shakil-nee/30min", allowedLinkHosts)).not.toBeNull();
    expect(safeHref("https://arshakil.com/privacy", allowedLinkHosts)).not.toBeNull();
    expect(safeHref("http://cal.com/x", allowedLinkHosts)).toBeNull();
    expect(safeHref("https://evil.example/x", allowedLinkHosts)).toBeNull();
    expect(safeHref("javascript:alert(1)", allowedLinkHosts)).toBeNull();
  });
  it("renders disallowed links as plain text", () => {
    const out = html("[click](https://evil.example/phish) and [book](https://cal.com/shakil-nee/30min)");
    expect(out).not.toContain("evil.example");
    expect(out).toContain('href="https://cal.com/shakil-nee/30min"');
  });
  it("never renders raw HTML", () => {
    const out = html('<img src=x onerror="alert(1)"> **bold**');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
    expect(out).toContain("<strong");
  });
  it("ignores a list marker that has no text yet (mid-stream)", () => {
    expect(parseBlocks("Also on the bench:\n\n- ")).toEqual([{ kind: "p", text: "Also on the bench:" }]);
    expect(parseBlocks("Intro\n- a\n- ")).toEqual([{ kind: "p", text: "Intro" }, { kind: "ul", items: ["a"] }]);
  });
  it("parses paragraphs and lists", () => {
    expect(parseBlocks("Intro\n\n- a\n- b\n\n1. one\n2. two").map((b) => b.kind)).toEqual(["p", "ul", "ol"]);
  });
});
