# Portfolio UI Kit

Recreation of the **ar.shakil** portfolio (AnisurRahmann/retro-profile) as a modular, high-fidelity JSX kit. All CSS is scoped with the `pf-` prefix so components can be dropped into other pages without collision.

## Files

- `index.html` — full home page: nav, hero (with typing animation), Now, Projects, Shipped For, Writing, About (text + stats + skills), Contact (availability pill, email with copy button, book-a-call, form, social links), footer.
- `components-core.jsx` — `Nav`, `Hero`, `SectionHeader`
- `components-sections.jsx` — `NowGrid`, `ProjectsGrid` + `ProjectCard`, `CompaniesGrid`, `WritingRow`, `Stats`, `Skills`, `Contact`
- `portfolio.css` — all styles

## Covered screens / states

- Home (single long-scroll page — matches the source app's architecture)
- Writing row (featured + standard variants, 3 category tints)
- Contact form with copy-to-clipboard micro-interaction
- Typing animation cycling `AI Engineer → Builder → Problem Solver`
- Pulsing availability indicator

Blog index and single post were out of scope for this first pass — the tokens and patterns in `portfolio.css` cover everything those screens need.
