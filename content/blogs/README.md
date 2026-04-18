# Blogs

One `.md` file per blog post. File naming: `NNN-slug.md` (zero-padded number).

## Frontmatter schema

```yaml
---
id: "aicp"                  # Unique slug (max 20 chars)
date: "Apr 18"              # Short date (max 10 chars)
year: "2026"                # 4-digit year
cat: "Building"             # Category chip (max 15 chars)
read: "4 min"               # Read time estimate (max 10 chars)
title: "AICP is live"       # Post title (max 60 chars)
excerpt: "..."              # Preview text (max 120 chars)
cover_c1: "#22c55e"         # Cover gradient start color
cover_c2: "#0a5e3e"         # Cover gradient end color
cover_glyph: "\u25C8"       # Single unicode character
---
```

## Chapters

After the frontmatter, write chapters using `---` separators.
Each chapter has a `kind` header and fields:

### Title chapter
```
## title
eyebrow: Ch. 01
title: The week AICP shipped
sub: After 9 months of benchmarks, we flipped the switch on Monday.
```

### Body chapter
```
## body
head: What changed
body: Average payload dropped 62% across our eval set...
```

### Quote chapter
```
## quote
q: "The best protocols are invisible until you take them away."
by: thing I kept repeating this week
```

### End chapter
```
## end
cta: Read the spec &rarr;
href: #
```

## Adding a new blog post

1. Create `content/blogs/NNN-slug.md` with frontmatter + chapters.
2. Run `npm run parse-content`.
3. The blog appears in the blog cards reel automatically.
