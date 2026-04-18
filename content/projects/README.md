# Projects

One `.md` file per project. File naming: `NNN-slug.md` (zero-padded number).

## Frontmatter schema

```yaml
---
num: "001"              # Zero-padded project number (3 digits)
title: "Fox"            # Bold part of name (max 20 chars)
italic: "reach"         # Italic part of name (max 20 chars)
desc: "..."             # Description (max 200 chars)
tags:                   # Max 3 tags, each max 15 chars
  - "LangGraph"
  - "FastAPI"
link: "#"               # Optional case study URL
---
```

## Adding a new project

1. Create `content/projects/NNN-slug.md` with the frontmatter above.
2. Add the project reel entry in `src/App.tsx` REELS array.
3. Run `npm run parse-content`.
