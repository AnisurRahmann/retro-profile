# Shakil Portfolio — Design System

An editorial dark portfolio design system for **Shakil (ar.shakil)** — a Fullstack AI Engineer based in Sylhet, Bangladesh. The system sits at the intersection of **brutalist typography** and **precision engineering**: terminal-green accent on near-black, an italic serif used sparingly for emotional punch against a utilitarian monospace baseline, and razor-sharp 1px borders instead of rounded cards.

The audience is **employers, recruiters, and clients**. Everything in the system — copy tone, metric-forward project cards, "Now" availability badge, writing feed — is engineered to signal: *senior operator, ships production AI, receipts on file*.

---

## Sources

- `uploads/Claude Design System Preview.html` — the brief / visual preview provided by the user
- GitHub repo **AnisurRahmann/retro-profile** (main branch) — the React codebase this design system is extracted from. Key files referenced:
  - `src/index.css` — all component styles, tokens, keyframes
  - `src/pages/Home.tsx` — hero, now, projects, shipped-for, writing, about, contact
  - `src/pages/BlogList.tsx`, `src/pages/BlogPost.tsx` — writing index + article

Do not assume the reader has access to either source; the extracted rules are captured in this folder.

---

## Products represented

Only one product: the **personal portfolio site** (`ar.shakil`). Surfaces:

1. **Home** — hero, Now/building, selected projects, shipped-for, writing feed, about + stats + skills, contact form
2. **Writing / Blog index** — filterable, featured post, insights grid, article list, newsletter
3. **Blog post** — article header, prose body with TOC sidebar, author card, related posts

---

## Content Fundamentals

**Voice:** First-person, confident without swagger. Past-tense proof ("Built", "Shipped", "Helped increase repayment rates by 90%") mixed with present-tense stance ("I build intelligent systems"). No hype words, no "rockstar", no "passionate about leveraging". Just verbs and receipts.

**Casing:** Sentence case for headlines and prose. ALL CAPS with wide letter-spacing (0.1–0.2em) for labels, nav items, stat labels, tags, section badges — this is the brutalist signal. Monospace + uppercase + small (10–12px) = "system chrome".

**Tone markers:**
- "I" vs "you": mostly "I" (portfolio), occasionally "Let's" in CTAs ("Let's Work Together")
- Metric-forward: lead with numbers when you have them ($900K, $1M+, 90%, 80%, 2.5K, 7 years)
- Geography as texture: "Based in Sylhet — available globally", "UK → Bangladesh → USA"
- Status signals: "Currently Building", "Available for work", "Open to roles", "Current" badge on Gerald

**Examples from the codebase:**
- Hero: "I'm Shakil, an *AI Engineer* & Builder"
- Hero sub: "I build intelligent systems and AI-powered products. Currently focused on LLM integrations, agent development, and helping startups ship AI features that users love."
- Contact: "Have an interesting project or opportunity? I'd love to hear from you."
- About: "My journey started in 2018 at Social Energy (UK), where I built energy monitoring systems. Since then, I've worked across the UK → Bangladesh → USA…"

**Punctuation:** The em-dash and arrow (→, ↗) are load-bearing. Arrows as "view more" affordances on cards; em-dash to join clauses tersely.

**Emoji:** None. Never. The brand uses unicode glyphs (→ ↗ ↑) and SVG icons only.

**Eyebrows/labels:** Prefixed with a 1.5rem green rule: `━━ FULLSTACK AI ENGINEER`. This motif repeats across hero eyebrows and section labels.

---

## Visual Foundations

### Color
Near-black canvas, one green accent, neutral greys. No secondary hue in the core palette — blue/purple appear *only* as blog-category tints (`#3b82f6`, `#a855f7`) at 15% opacity.

- `--bg` `#0a0a0a` — canvas
- `--bg-elevated` `#111111` — cards, form fields, contact band
- `--border` `#262626` / preview uses `#1f1f1f` — 1px hairlines everywhere
- `--text` `#fafafa` / `#f5f5f5` — body
- `--text-muted` `#737373` / `#6b6b6b` — labels, meta, descriptions
- `--accent` `#22c55e` — terminal green, used sparingly for italic serif emphasis, CTAs, live dots, and eyebrow rules
- `--accent-dim` `#16a34a` — hover state for primary button
- `--accent-10` `rgba(34,197,94,0.1)` — tinted fills on badges, availability pill

### Type
- **Serif display** — *Instrument Serif* (Google Fonts). Used italic for accent words in hero, stat numbers, project/card titles, section titles. Editorial punctuation.
- **Sans body** — *Satoshi* (falls back to system). Paragraphs, form inputs.
- **Mono system** — *JetBrains Mono*. Nav, buttons, labels, tags, meta, stat-labels. The mono is the workhorse — >50% of the visible type.

Type scale is wide: labels sit at 10–12px, body at 15–18px, headlines clamp up to 88px (`clamp(3rem, 8vw, 5.5rem)`). Italic serif inside a mono-heavy layout is the brand's signature tension.

### Spacing
Generous — sections use `6rem 2rem` padding, hero is full viewport, cards are `2rem` padded. Density is achieved through type contrast, not packed layouts.

### Backgrounds
- Flat `#0a0a0a` canvas throughout — no gradients on backgrounds
- One subtle global texture: an SVG fractal-noise overlay at 3% opacity, fixed, on top of everything (`body::before`). Adds paper-grain without being visible as noise.
- Hero title uses a subtle `linear-gradient(135deg, text 0% → accent 100%)` animated background-clip for a slow shimmer (8s loop)
- Writing-featured card uses `linear-gradient(90deg, accent-10 → transparent)` + 3px left border — the *only* place the left-border-accent motif appears, and it's pulled from the source

### Animation
- Global easing: `0.3s ease` — cubic-bezier identity, utilitarian
- `pulse` 2s infinite on status dots (box-shadow ring + opacity)
- `blink` 1s step-end for the typing cursor
- `gradientShift` 8s infinite on hero title
- `bounce` 2s on the scroll chevron
- Hover transforms: `translateY(-2px)` or `-4px` on cards; `translateX(+1rem)` padding-left nudge on writing rows (text slides right into the hover state)

### Hover states
- **Cards** — border flips from `--border` to `--accent`, often paired with `translateY(-2px)` lift
- **Text links** — color fades to `--accent` over 0.3s
- **Primary button** — background darkens to `--accent-dim`
- **Nav links** — color transitions to `--accent`
- **Writing rows** — shift right by 1rem padding-left, gradient bleeds in, title turns green, excerpt expands from `max-height: 0` → `50px`
- **Social links** — `translateY(-4px)` lift + label fades in

### Press states
No dedicated press/active CSS — the system relies on hover alone.

### Borders
**1px solid `--border`** on essentially everything. No rounded corners — radius is `0` by default. The only radii in the codebase: `border-radius: 50%` on dots, `2px` on category-badge chips, `8px` on the hamburger. **Hard corners are the brand.**

### Shadows
Shadows are near-absent. The one shadow in the system: the pulsing `box-shadow: 0 0 0 0 → 8px rgba(34,197,94,0.4)` ring on the status dot. No drop shadows on cards, no elevation system. Depth comes from `--bg` vs `--bg-elevated` + hairline borders.

### Transparency & blur
- Nav is `rgba(10,10,10,0.8)` with `backdrop-filter: blur(10px)` — the only blur in the system
- Mobile overlay: `rgba(0,0,0,0.5)`
- Global noise at 3% opacity
- Accent-tinted fills always at 10–15% opacity on badges

### Imagery
Portfolio is currently text-first — no hero imagery in the source. Brand color vibe for any future imagery: **cool, high-contrast, near-monochrome with a green accent spot**. If imagery is added, treat it as editorial/documentary — grain welcome, warmth discouraged.

### Cards
No shadows, no radius, 1px border, `--bg-elevated` fill, `2rem` padding. Hover flips border to green. The featured writing card is the sole exception — it adds a 3px left accent border and a horizontal gradient fill.

### Layout rules
- Max content width `1200px`, centered
- Fixed nav at top with blur + bottom border
- Section pattern: `[badge] [title] ────────── line` — the hairline stretches to fill the remaining row
- Grids collapse at 1024px and 768px predictably
- Mobile nav is a slide-in drawer from the right (280px wide), hamburger animates into an X

---

## Iconography

The source uses **Heroicons (outline, 24px)** via `@heroicons/react/24/outline` — specifically `ArrowUpRightIcon` on project cards. Everything else is hand-authored SVGs inline in JSX: chevrons (scroll indicator), calendar (book-a-call), copy + check (clipboard), GitHub / Twitter (X) / LinkedIn brand marks. All SVGs use `stroke="currentColor"`, `stroke-width="2"`, `fill="none"` — a uniform outline style at 20–32px.

**Substitution in this system:** Heroicons outline is loaded from CDN (`https://unpkg.com/heroicons@2.1.5/24/outline/`) — same stroke weight, identical visual. Brand-mark SVGs (GitHub/X/LinkedIn) are copied verbatim into `assets/icons/`.

**Unicode used as icons:**
- `→` arrow right — in CTAs ("View Work →", "View Projects →")
- `↗` up-right arrow — on project card hover hints, external links
- `↑` up arrow — in stat labels ("Repayment Rate ↑", "Revenue ↑")
- `|` pipe — as typing cursor
- `&` ampersand — stylized in the hero ("& Builder")

**No emoji.** Ever. This is a hard brand rule.

**Logo:** The wordmark `SHAKIL.` (mono, 14px, letter-spacing 0.05em) or `ar.shakil` (mono with green period). There is no pictorial logo — the typography *is* the logo.

---

## File index

```
README.md                    ← you are here
SKILL.md                     ← skill manifest (user-invocable)
colors_and_type.css          ← CSS variables: colors, fonts, semantic type scales
fonts/                       ← Instrument Serif, JetBrains Mono (Google-Fonts-sourced CSS)
assets/
  icons/                     ← GitHub, X, LinkedIn SVGs + Heroicons reference
preview/                     ← Design System cards (registered assets)
ui_kits/
  portfolio/                 ← React JSX components + index.html (Home + Writing)
```

### UI kits
- **portfolio** — `ui_kits/portfolio/index.html` shows the full home page with interactive nav, typing animation, project cards, now grid, writing list, stats, and contact form.

---

## Caveats / substitutions

- **Fonts:** *Satoshi* is not on Google Fonts — the codebase ships without it and falls back to the system sans stack. This design system does the same (no attempt to substitute). If you have a Satoshi license, drop the files in `fonts/` and the tokens will pick them up.
- **Heroicons** is loaded from CDN rather than bundled.
- The preview file uses `--border: #1f1f1f` while the codebase uses `#262626`. We follow the **codebase** (`#262626`) as source of truth; the preview's slightly darker border is reconciled away.
