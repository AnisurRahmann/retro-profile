#!/usr/bin/env node

/**
 * inject-route-meta.js (postbuild)
 *
 * The app is a client-rendered SPA: social scrapers (Facebook, Twitter,
 * LinkedIn, iMessage) never run JS, so every route would otherwise share
 * whatever is in index.html. This script clones the built index.html into
 * per-route files with route-specific title / description / OG / Twitter
 * tags stamped in, e.g. build/gym/index.html for /gym.
 *
 * Keep the values in sync with src/lib/pageMeta.ts (PAGES).
 *
 * Usage: runs automatically after `npm run build`.
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const SITE_URL = 'https://retro-profile.vercel.app';

// ── Route meta (keep in sync with src/lib/pageMeta.ts) ───────────────

const ROUTES = {
  gym: {
    path: '/gym',
    title: 'Shakil | Gym Split',
    description:
      'My weekly training split — seven days, one screen each. Upper, Lower, Push, Pull, Legs, Core and a rest day.',
    image: `${SITE_URL}/og-gym.png`,
  },
};

// ── Tag rewriters ────────────────────────────────────────────────────

function setTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
}

function setMeta(html, attr, key, content) {
  const escaped = content.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const pattern = new RegExp(`<meta ${attr}="${key}" content="[\\s\\S]*?"\\s*/>`);
  if (!pattern.test(html)) {
    throw new Error(`inject-route-meta: could not find <meta ${attr}="${key}"> in build/index.html`);
  }
  return html.replace(pattern, `<meta ${attr}="${key}" content="${escaped}"/>`);
}

function setCanonical(html, href) {
  const pattern = /<link rel="canonical" href="[^"]*"\s*\/>/;
  if (!pattern.test(html)) {
    throw new Error('inject-route-meta: could not find canonical link in build/index.html');
  }
  return html.replace(pattern, `<link rel="canonical" href="${href}"/>`);
}

// ── Main ─────────────────────────────────────────────────────────────

const indexPath = path.join(BUILD_DIR, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('inject-route-meta: build/index.html not found — run `npm run build` first.');
  process.exit(1);
}
const base = fs.readFileSync(indexPath, 'utf8');

for (const [route, meta] of Object.entries(ROUTES)) {
  let html = base;
  html = setTitle(html, meta.title);
  html = setMeta(html, 'name', 'description', meta.description);
  html = setCanonical(html, SITE_URL + meta.path);
  html = setMeta(html, 'property', 'og:title', meta.title);
  html = setMeta(html, 'property', 'og:description', meta.description);
  html = setMeta(html, 'property', 'og:image', meta.image);
  html = setMeta(html, 'property', 'og:url', SITE_URL + meta.path);
  html = setMeta(html, 'name', 'twitter:title', meta.title);
  html = setMeta(html, 'name', 'twitter:description', meta.description);
  html = setMeta(html, 'name', 'twitter:image', meta.image);

  const routeDir = path.join(BUILD_DIR, route);
  fs.mkdirSync(routeDir, { recursive: true });
  fs.writeFileSync(path.join(routeDir, 'index.html'), html);
  console.log(`inject-route-meta: wrote build/${route}/index.html`);
}
