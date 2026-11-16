/**
 * Counts the first number in a node's text up to its final value, once, and leaves the text exactly as it was.
 * Text without a number is left alone. Client-safe: no content import. Returns a cancel function.
 */
export function countUp(node: HTMLElement, ms = 700): () => void {
  const final = node.textContent ?? "";
  const match = /\d[\d,]*(?:\.\d+)?/.exec(final);
  if (!match) return () => {};
  const target = Number(match[0].replace(/,/g, ""));
  const decimals = match[0].split(".")[1]?.length ?? 0;
  const grouped = match[0].includes(",");
  const started = performance.now();
  let frame = 0;
  node.style.fontVariantNumeric = "tabular-nums";
  const tick = (now: number) => {
    const progress = Math.min(1, (now - started) / ms);
    const eased = 1 - (1 - progress) ** 3;
    const value = (target * eased).toFixed(decimals);
    const shown = grouped ? Number(value).toLocaleString("en-US") : value;
    node.textContent = progress === 1 ? final : final.replace(match[0], shown);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    cancelAnimationFrame(frame);
    node.textContent = final;
  };
}
