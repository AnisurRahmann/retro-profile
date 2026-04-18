---
name: shakil-portfolio-design
description: Use this skill to generate well-branded interfaces and assets for the Shakil (ar.shakil) Fullstack AI Engineer portfolio, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

Key references:
- `README.md` — brand context, content fundamentals, visual foundations, iconography, file index
- `colors_and_type.css` — design tokens (CSS variables for colors, fonts, spacing, radii, motion) + semantic type classes (`.ds-display`, `.ds-h2`, `.ds-eyebrow`, `.ds-label`, …)
- `assets/icons/` — GitHub / X / LinkedIn brand SVGs + arrow-up-right (Heroicons style)
- `ui_kits/portfolio/` — full React recreation of the home page; `components-core.jsx` + `components-sections.jsx` + scoped `portfolio.css`. Read `ui_kits/portfolio/README.md` for component list.
- `preview/` — per-concept design system cards (colors, type, spacing, components, brand)

Non-negotiable brand rules:
- **No emoji.** Use unicode glyphs (→ ↗ ↑ &) or Heroicons outline / brand SVGs instead.
- **Hard corners.** Default radius is 0; 2px only on category chips; 50% on dots.
- **One accent.** Terminal green `#22c55e`. Italic Instrument Serif is the *only* way to emphasize — never bold the serif, never color body text green.
- **Mono does the heavy lifting.** JetBrains Mono on labels, buttons, nav, tags, meta — all uppercase with 0.1–0.2em tracking.
- **1px hairline borders, no shadows.** Depth comes from `--bg` vs `--bg-elevated`, not elevation.
- **Metric-forward copy.** Lead with numbers where you have them. Sentence case for prose, ALL CAPS for labels.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. Load `colors_and_type.css` and lift components from `ui_kits/portfolio/` rather than rewriting them.

If working on production code, apply the tokens and component patterns from the codebase in `ui_kits/portfolio/`.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
