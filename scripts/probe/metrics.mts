import { chromium } from "@playwright/test";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://localhost:3100/", { waitUntil: "networkidle" });
const m = await p.evaluate(() => {
  const title = document.querySelector("#shipped .card span.font-medium") as HTMLElement;
  const cs = getComputedStyle(title);
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const H = ctx.measureText("H");
  const rows = [...document.querySelectorAll("#shipped .card")].map((c) => {
    const t = c.querySelector("span.font-medium")!.getBoundingClientRect();
    const tile = c.querySelector(".tile")!.getBoundingClientRect();
    return { titleTop: Math.round(t.top), tileTop: Math.round(tile.top), cardTop: Math.round(c.getBoundingClientRect().top) };
  });
  const portrait = document.querySelector('[role="img"]') as HTMLElement | null;
  return { font: cs.fontFamily.slice(0, 40), lineHeight: cs.lineHeight, capAscent: H.actualBoundingBoxAscent, fontAscent: H.fontBoundingBoxAscent, fontDescent: H.fontBoundingBoxDescent, rows, portraitFont: portrait && getComputedStyle(portrait).fontFamily.slice(0, 40), headerFont: getComputedStyle(document.querySelector("header a")!).fontFamily.slice(0, 40) };
});
console.log(JSON.stringify(m, null, 1));
await p.getByRole("link", { name: "Lifts" }).click();
await p.waitForURL(/lifts/);
await p.waitForTimeout(300);
console.log("after client nav, activeElement:", await p.evaluate(() => { const a = document.activeElement!; return a.tagName + " " + a.className.slice(0, 40) + " outline=" + getComputedStyle(a).outlineStyle + " top=" + a.getBoundingClientRect().top; }));
await b.close();
