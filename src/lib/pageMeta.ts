// Per-page meta (title, description, canonical, Open Graph / Twitter preview).
// index.html carries the home defaults so scrapers that never run JS still get
// correct tags; this module re-applies per route at runtime and lets overlays
// (e.g. the blog viewer) override and restore.

import { useEffect } from 'react';

export const SITE_URL = 'https://retro-profile.vercel.app';

export interface PageMeta {
  title: string;
  description: string;
  /** Absolute URL of the 1200x630 social preview card. */
  image: string;
  /** Canonical path, '/' for home. */
  path: string;
}

export const PAGES = {
  home: {
    title: 'Shakil | AI Engineer & Builder',
    description:
      'Shakil — AI Engineer & Builder. 7 years in production, $900K+ saved on Plaid, $1M+/month GMV shipped. Currently at Gerald (YC W21).',
    image: `${SITE_URL}/og-home.png`,
    path: '/',
  },
  gym: {
    title: 'Shakil | Gym Split',
    description: 'My weekly training split — seven days, one screen each. Upper, Lower, Push, Pull, Legs, Core and a rest day.',
    image: `${SITE_URL}/og-gym.png`,
    path: '/gym',
  },
} satisfies Record<string, PageMeta>;

export type PageKey = keyof typeof PAGES;

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
}

export function applyPageMeta(page: PageMeta) {
  document.title = page.title;
  upsertMeta('name', 'description', page.description);
  upsertCanonical(`${SITE_URL}${page.path}`);
  upsertMeta('property', 'og:title', page.title);
  upsertMeta('property', 'og:description', page.description);
  upsertMeta('property', 'og:image', page.image);
  upsertMeta('property', 'og:url', `${SITE_URL}${page.path}`);
  upsertMeta('name', 'twitter:title', page.title);
  upsertMeta('name', 'twitter:description', page.description);
  upsertMeta('name', 'twitter:image', page.image);
}

/** Apply a page's meta on mount. */
export function usePageMeta(page: PageKey) {
  useEffect(() => {
    applyPageMeta(PAGES[page]);
  }, [page]);
}
