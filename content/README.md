# Content Feed

This folder is the single source of truth for all portfolio content.
Edit the `.md` files, then run `npm run parse-content` to regenerate `src/data/portfolio.ts`.

## Folder structure

```
content/
  hero.md              # Intro reel
  now.md               # "Currently building" items
  stats.md             # Impact numbers grid
  about.md             # Bio + meta grid
  contact.md           # Contact links
  outro.md             # End card
  socials.md           # Social links (used in action rail)
  skills.md            # Tech stack
  companies.md         # Companies worked with
  projects/
    001-foxreach.md    # One file per project
    002-tabsense.md
    003-mvpkit.md
  blogs/
    001-aicp.md        # One file per blog post
    ...
```

## Content constraints

Every section has hard limits so the UI does not break.
AI tools: respect these or the reel will overflow.

| Section | Field | Max chars | Notes |
|---------|-------|-----------|-------|
| **hero** | eyebrow | 30 | Uppercase label above title |
| | title | 50 | Display text, use `<em>` for italic |
| | lede | 150 | One paragraph summary |
| | location | 30 | City + availability status |
| **now** | item title | 30 | Short project/tool name |
| | item desc | 100 | One sentence description |
| **stats** | number | 12 | e.g. "$900K", "90%" |
| | label | 30 | e.g. "Saved / year via AI" |
| **project** | title | 20 | Bold part of name |
| | italic | 20 | Italic part of name |
| | desc | 200 | One or two sentences |
| | tags | 15 each | Max 3 tags, uppercase monospace |
| **company** | name | 20 | Company name |
| | location | 30 | e.g. "USA . Remote" |
| | badge | 20 | Optional, e.g. "YC W21" |
| | clients | 20 each | Optional list |
| **skills** | skill | 20 each | Tech/tool name |
| **about** | quote | 120 | Italic pull quote |
| | body | 300 | Bio paragraph |
| | meta label | 15 | e.g. "Based", "Timezone" |
| | meta value | 20 | e.g. "Sylhet, BD" |
| **contact** | label | 15 | e.g. "Email" |
| | value | 40 | Display value |
| **outro** | heading | 40 | Farewell heading |
| | sub | 100 | Closing line |
| **blog** | title | 60 | Blog post title |
| | excerpt | 120 | Preview text |
| | cat | 15 | Category chip label |
| | cover glyph | 3 | Single unicode character |
| | cover c1, c2 | 7 | Hex color e.g. "#22c55e" |
| **blog chapter** | eyebrow | 10 | e.g. "Ch. 01" |
| | head | 50 | Section heading |
| | body | 300 | Paragraph text |
| | quote | 200 | Pull quote text |
| | by | 60 | Quote attribution |
| | cta | 30 | Button label |
| **socials** | label | 15 | Platform name |
| | handle | 40 | @handle or email |
| **writing** | title | 80 | Article title |
| | cat | 15 | Category |

## General rules

- No emoji. Unicode glyphs only (arrows, bullets, geometric shapes).
- Use `&middot;` for dots, `&mdash;` for dashes, `&rarr;` for arrows.
- All text is plain ASCII/Unicode. No markdown formatting in content values.
- One accent color: `#22c55e` (terminal green).
- Cover colors: any hex pair that contrasts well on dark bg.

## How it works

1. Each `.md` file uses YAML frontmatter (`---` blocks) for structured data.
2. Blog posts use `---chapters---` separator between metadata and chapter content.
3. The parser (`scripts/parse-content.js`) reads all files and outputs `src/data/portfolio.ts`.
4. The app imports from `src/data/portfolio.ts` -- never reads content/ at runtime.

## Adding new content

1. Create a new `.md` file in the right subfolder.
2. Follow the frontmatter schema shown in existing files.
3. Run `npm run parse-content`.
4. The new data appears in the app on next build.
