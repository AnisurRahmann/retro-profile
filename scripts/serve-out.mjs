// Minimal static file server for the exported site in ./out (used by Playwright and Lighthouse).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

const root = join(process.cwd(), "out");
const port = Number(process.argv[2] ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};
const compressible = new Set([".html", ".js", ".css", ".json", ".svg", ".txt", ".xml"]);

async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split("?")[0] ?? "/")).replace(/^(\.\.[/\\])+/, "");
  const candidates = [clean, join(clean, "index.html"), `${clean}.html`];
  for (const candidate of candidates) {
    const file = join(root, candidate);
    if (!file.startsWith(root)) continue;
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(req.url ?? "/");
  if (!file) {
    const notFound = await readFile(join(root, "404.html")).catch(() => "Not found");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
    res.end(notFound);
    return;
  }
  const ext = extname(file);
  let body = await readFile(file);
  const headers = {
    "content-type": types[ext] ?? "application/octet-stream",
    "cache-control": file.includes("/_next/static/") ? "public, max-age=31536000, immutable" : "no-cache",
  };
  if (compressible.has(ext) && /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) {
    body = gzipSync(body);
    headers["content-encoding"] = "gzip";
  }
  res.writeHead(200, headers);
  res.end(body);
}).listen(port, () => console.log(`serving out/ on http://localhost:${port}`));
