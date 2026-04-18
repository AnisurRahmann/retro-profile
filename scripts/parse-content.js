#!/usr/bin/env node

/**
 * parse-content.js
 *
 * Reads all .md files from content/ and generates src/data/portfolio.ts.
 *
 * Usage:  node scripts/parse-content.js
 *         npm run parse-content
 */

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '..', 'content');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'portfolio.ts');

// ── YAML-like frontmatter parser (simple, no external deps) ──────────

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: raw };

  const yaml = match[1];
  const body = raw.slice(match[0].length).trim();
  const meta = parseYaml(yaml);
  return { meta, body };
}

function parseYaml(text) {
  // Simple YAML parser: handles strings, numbers, booleans, arrays of strings/objects, nested maps
  const lines = text.split('\n');
  const result = {};
  let i = 0;

  function skipComments() {
    while (i < lines.length && lines[i].match(/^\s*#/)) i++;
  }

  function parseValue(val) {
    val = val.trim();
    if (val === 'true') return true;
    if (val === 'false') return false;
    if (val === 'null' || val === '') return null;
    // Strip matching outer quotes (single or double)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      return val.slice(1, -1);
    }
    if (/^-?\d+$/.test(val)) return parseInt(val, 10);
    if (/^-?\d+\.\d+$/.test(val)) return parseFloat(val);
    return val;
  }

  function parseBlock(startIndent) {
    const obj = {};
    while (i < lines.length) {
      skipComments();
      if (i >= lines.length) break;

      const line = lines[i];
      const indent = line.search(/\S/);
      if (indent < startIndent) break;

      const content = line.trim();

      // Array item
      if (content.startsWith('- ')) {
        // This is handled by parseArray
        break;
      }

      // Key: value
      const kvMatch = content.match(/^([^:]+):\s*(.*)/);
      if (!kvMatch) { i++; continue; }

      const key = kvMatch[1].trim();
      const rawVal = kvMatch[2].trim();

      if (rawVal === '' || rawVal === '|') {
        // Nested block or array
        i++;
        if (i < lines.length) {
          const nextLine = lines[i];
          const nextIndent = nextLine.search(/\S/);
          const nextContent = nextLine.trim();

          if (nextContent.startsWith('- ')) {
            obj[key] = parseArray(nextIndent);
          } else {
            obj[key] = parseBlock(nextIndent);
          }
        } else {
          obj[key] = null;
        }
      } else {
        obj[key] = parseValue(rawVal);
        i++;
      }
    }
    return obj;
  }

  function parseArray(indent) {
    const arr = [];
    while (i < lines.length) {
      skipComments();
      if (i >= lines.length) break;

      const line = lines[i];
      const lineIndent = line.search(/\S/);
      if (lineIndent < indent) break;

      const content = line.trim();
      if (!content.startsWith('- ')) break;

      const afterDash = content.slice(2).trim();

      // Check if it's "key: value" (object item)
      if (afterDash.includes(': ') && !afterDash.startsWith('"')) {
        // Object item: collect all key-value pairs at same indent
        const obj = {};
        // First key-value on the "- " line
        const firstKv = afterDash.match(/^([^:]+):\s*(.*)/);
        if (firstKv) {
          const k = firstKv[1].trim();
          const v = firstKv[2].trim();
          if (v === '') {
            i++;
            // Could be nested, but for our schema we keep it simple
            obj[k] = null;
          } else {
            obj[k] = parseValue(v);
            i++;
          }
        }
        // Subsequent key-value lines at indent + 2
        const subIndent = lineIndent + 2;
        while (i < lines.length) {
          const subLine = lines[i];
          const subLineIndent = subLine.search(/\S/);
          if (subLineIndent < subIndent) break;
          const subContent = subLine.trim();
          if (subContent.startsWith('- ')) break;
          const subKv = subContent.match(/^([^:]+):\s*(.*)/);
          if (subKv) {
            const sk = subKv[1].trim();
            const sv = subKv[2].trim();
            if (sv === '') {
              i++;
              // Check for nested array
              if (i < lines.length) {
                const nextSubLine = lines[i];
                const nextSubIndent = nextSubLine.search(/\S/);
                const nextSubContent = nextSubLine.trim();
                if (nextSubContent.startsWith('- ')) {
                  obj[sk] = parseArray(nextSubIndent);
                } else {
                  obj[sk] = null;
                }
              }
            } else {
              obj[sk] = parseValue(sv);
              i++;
            }
          } else {
            i++;
          }
        }
        arr.push(obj);
      } else {
        // Simple string/number item
        arr.push(parseValue(afterDash));
        i++;
      }
    }
    return arr;
  }

  skipComments();
  return parseBlock(0);
}

// ── Blog chapter parser ──────────────────────────────────────────────

function parseChapters(body) {
  if (!body) return [];

  const chapters = [];
  const sections = body.split(/^## /m).filter(Boolean);

  for (const section of sections) {
    const lines = section.split('\n');
    const kind = lines[0].trim();
    const fields = {};

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (!line || line.startsWith('#')) continue;
      const kvMatch = line.match(/^(\w+):\s*(.*)/);
      if (kvMatch) {
        let val = kvMatch[2].trim();
        // Strip matching outer quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        fields[kvMatch[1]] = val;
      }
    }

    chapters.push({ kind, ...fields });
  }

  return chapters;
}

// ── File readers ─────────────────────────────────────────────────────

function readContent(name) {
  const filePath = path.join(CONTENT_DIR, name);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return parseFrontmatter(raw);
}

function readContentDir(subdir) {
  const dir = path.join(CONTENT_DIR, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const parsed = parseFrontmatter(raw);
      return parsed.meta;
    });
}

function readBlogs() {
  const dir = path.join(CONTENT_DIR, 'blogs');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { meta, body } = parseFrontmatter(raw);
      const chapters = parseChapters(body);
      return { ...meta, chapters };
    });
}

// ── Load all content ─────────────────────────────────────────────────

const hero = readContent('hero.md')?.meta || {};
const nowData = readContent('now.md')?.meta || {};
const statsData = readContent('stats.md')?.meta || {};
const about = readContent('about.md')?.meta || {};
const contact = readContent('contact.md')?.meta || {};
const outro = readContent('outro.md')?.meta || {};
const socials = readContent('socials.md')?.meta || {};
const skills = readContent('skills.md')?.meta || {};
const companies = readContent('companies.md')?.meta || {};
const projects = readContentDir('projects');
const blogs = readBlogs();

// ── Generate TypeScript ──────────────────────────────────────────────

function tsVal(val, indent = '  ') {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    // Escape single quotes and special chars for TS strings
    const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const items = val.map(v => tsVal(v, indent + '  '));
    // Simple arrays on one line if all strings
    if (val.every(v => typeof v === 'string')) {
      return '[' + items.join(', ') + ']';
    }
    return '[\n' + items.map(v => indent + '  ' + v).join(',\n') + ',\n' + indent + ']';
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val).filter(([_, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    const pairs = entries.map(([k, v]) => {
      const tsKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `'${k}'`;
      return indent + '  ' + tsKey + ': ' + tsVal(v, indent + '  ') + ',';
    });
    return '{\n' + pairs.join('\n') + '\n' + indent + '}';
  }
  return String(val);
}

// Generate blog chapter with proper typing
function tsChapter(ch) {
  const pairs = [`    kind: '${ch.kind}'`];
  for (const [k, v] of Object.entries(ch)) {
    if (k === 'kind') continue;
    if (v === undefined || v === null) continue;
    pairs.push(`    ${/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : `'${k}'`}: ${tsVal(v, '    ')}`);
  }
  return '  {\n' + pairs.join(',\n') + ',\n  }';
}

function tsBlog(blog) {
  const cover = `c1: '${blog.cover_c1}', c2: '${blog.cover_c2}', glyph: '${blog.cover_glyph}'`;
  const chaptersStr = blog.chapters.map(tsChapter).join(',\n');

  return `  {
    id: '${blog.id}',
    date: '${blog.date}',
    year: '${blog.year}',
    cat: '${blog.cat}',
    read: '${blog.read}',
    title: '${blog.title}',
    excerpt: '${(blog.excerpt || '').replace(/'/g, "\\'")}',
    cover: { ${cover} },
    chapters: [
${chaptersStr}
    ],
  }`;
}

const output = `// ── AUTO-GENERATED by scripts/parse-content.js ────────────
// Do not edit this file directly.
// Edit files in content/ and run: npm run parse-content

// ── Types ──────────────────────────────────────────────────
export interface Project {
  num: string;
  title: string;
  italic: string;
  desc: string;
  tags: string[];
  link?: string;
}

export interface Company {
  name: string;
  location: string;
  badge?: string;
  current?: boolean;
  clients?: string[];
}

export interface Stat {
  number: string;
  label: string;
}

export interface SocialLink {
  id: string;
  label: string;
  handle: string;
  href: string;
}

export interface BlogChapter {
  kind: 'title' | 'body' | 'quote' | 'end';
  eyebrow?: string;
  title?: string;
  sub?: string;
  head?: string;
  body?: string;
  q?: string;
  by?: string;
  cta?: string;
  href?: string;
}

export interface Blog {
  id: string;
  date: string;
  year: string;
  cat: string;
  read: string;
  title: string;
  excerpt: string;
  cover: { c1: string; c2: string; glyph: string };
  chapters: BlogChapter[];
}

export interface NowItem {
  title: string;
  desc: string;
  live?: boolean;
}

export interface HeroData {
  eyebrow: string;
  title_line1: string;
  title_em: string;
  title_line3: string;
  lede: string;
  location: string;
  ring: boolean;
}

export interface AboutData {
  quote: string;
  body: string;
  meta: Array<{ label: string; value: string }>;
}

export interface OutroData {
  heading_line1: string;
  heading_em: string;
  sub: string;
  cta_label: string;
  cta_href: string;
  replay_label: string;
}

export interface ContactRow {
  label: string;
  value: string;
  href: string;
}

export interface WritingPost {
  title: string;
  date: string;
  cat: string;
  read: string;
}

// ── Data ───────────────────────────────────────────────────

export const HERO: HeroData = ${tsVal(hero)};

export const NOW_ITEMS: NowItem[] = ${tsVal(nowData.items || [])};

export const STATS: Stat[] = ${tsVal(statsData.items || [])};

export const PROJECTS: Project[] = ${tsVal(projects)};

export const COMPANIES: Company[] = ${tsVal(companies.companies || [])};

export const SKILLS_PRIMARY = ${tsVal(skills.primary || [])};
export const SKILLS_SECONDARY = ${tsVal(skills.secondary || [])};

export const SOCIALS: SocialLink[] = ${tsVal(socials.links || [])};

export const CONTACT_ROWS: ContactRow[] = ${tsVal(contact.rows || [])};

export const ABOUT: AboutData = ${tsVal(about)};

export const OUTRO: OutroData = ${tsVal(outro)};

export const WRITING_POSTS: WritingPost[] = ${tsVal(
  blogs.map(b => ({ title: b.title, date: `${b.date} ${b.year}`, cat: b.cat, read: b.read }))
)};

export const BLOGS: Blog[] = [
${blogs.map(tsBlog).join(',\n')}
];
`;

fs.writeFileSync(OUTPUT_FILE, output, 'utf-8');

// ── Summary ────────────────────────────────────────────────
const counts = {
  hero: Object.keys(hero).length > 0 ? 1 : 0,
  now: (nowData.items || []).length,
  stats: (statsData.items || []).length,
  projects: projects.length,
  companies: (companies.companies || []).length,
  skills: (skills.primary || []).length + (skills.secondary || []).length,
  socials: (socials.links || []).length,
  contact: (contact.rows || []).length,
  blogs: blogs.length,
  chapters: blogs.reduce((sum, b) => sum + (b.chapters || []).length, 0),
};

console.log('Content parsed -> src/data/portfolio.ts');
console.log(`  hero: ${counts.hero} | now: ${counts.now} | stats: ${counts.stats}`);
console.log(`  projects: ${counts.projects} | companies: ${counts.companies} | skills: ${counts.skills}`);
console.log(`  socials: ${counts.socials} | contact: ${counts.contact}`);
console.log(`  blogs: ${counts.blogs} (${counts.chapters} chapters)`);
