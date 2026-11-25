import { z } from "zod";

/** Any value still shaped like [[...]] is an unresolved placeholder. */
export const PLACEHOLDER = /\[\[[^\]]*\]\]/;
export const isPlaceholder = (v: unknown): boolean => typeof v === "string" && PLACEHOLDER.test(v);

const id = z.string().regex(/^[a-z0-9-]+$/, "ids are kebab-case");
const text = z.string().min(1);
const url = z.string().refine((v) => isPlaceholder(v) || /^https:\/\//.test(v), "https url or [[placeholder]]");

export const profileSchema = z.object({
  name: text,
  legalName: text,
  title: text,
  oneLiner: text,
  summary: text,
  location: text,
  credentials: text,
  portrait: z.string().startsWith("/"),
  statusLines: z.array(text).min(1),
});

export const linksSchema = z.object({
  github: url,
  linkedin: url,
  email: z.email(),
  calendar: url,
  site: url,
});

export const projectSchema = z.object({
  id,
  title: text,
  subtitle: text,
  caseStudy: id.optional(),
  href: url.optional(),
});

export const benchSchema = projectSchema.extend({
  status: z.enum(["in-build", "built-not-deployed"]),
});

export const resultSchema = z.object({
  label: text,
  before: text.optional(),
  after: text,
});

export const caseStudySchema = z.object({
  slug: id,
  projectId: id,
  title: text,
  org: text,
  period: text.optional(),
  role: text,
  problem: text,
  built: text,
  flow: z.array(text).min(2),
  results: z.array(resultSchema).min(1),
  stack: z.array(text).min(1),
});

export const reactionSchema = z.object({ emoji: text, count: z.number().int().positive() });

export const receiptSchema = z.object({
  id,
  kind: z.enum(["app", "human"]),
  channel: text,
  org: text.optional(),
  author: text,
  avatar: z.string().optional(),
  date: text.optional(),
  time: text.optional(),
  body: text,
  href: url.optional(),
  reactions: z.array(reactionSchema).default([]),
});

export const closerSchema = z.object({ heading: text, body: text });

export const exerciseSchema = z.object({
  name: text,
  prescription: text,
  note: text.optional(),
});

export const routineDaySchema = z.object({
  id,
  weekday: text,
  title: text,
  duration: text.optional(),
  rest: z.boolean().default(false),
  restLine: text.optional(),
  exercises: z.array(exerciseSchema),
});

export const liftsSchema = z.object({
  intro: text,
  rules: z.array(text).default([]),
  routines: z.array(routineDaySchema),
});

export const agentFactSchema = z.object({
  topic: text,
  fact: text,
  internal: z.boolean().default(false),
});

export const servicesSchema = z.object({
  offer: text,
  pricing: text,
  roles: text,
});

export const uiSchema = z.object({
  meta: z.object({ title: text, chatTitle: text, chatDescription: text, liftsDescription: text }),
  nav: z.object({ chat: text, work: text, lifts: text, home: text }),
  home: z.object({
    shipped: text,
    bench: text,
    receipts: text,
    receiptsNote: text,
    showMore: text,
    showLess: text,
    statusInBuild: text,
    statusBuilt: text,
    bookCta: text,
    chatCta: text,
    appBadge: text,
  }),
  work: z.object({
    back: text,
    problem: text,
    built: text,
    flow: text,
    result: text,
    stack: text,
    askLine: text,
    askQuery: text,
  }),
  lifts: z.object({ heading: text, day: text, exercise: text, sets: text, liftLink: text }),
  footer: z.object({ github: text, linkedin: text, privacy: text }),
  privacy: z.object({
    heading: text,
    sections: z.array(z.object({ heading: text, body: text, links: z.array(z.object({ label: text, href: url })).optional() })),
  }),
  chat: z.object({
    heading: text,
    sub: text,
    placeholder: text,
    inputLabel: text,
    chips: z.array(text).length(4),
    send: text,
    stop: text,
    newChat: text,
    rateLimited: text,
    broken: text,
    disabled: text,
    bookTitle: text,
    bookButton: text,
    introTitle: text,
    introName: text,
    introEmail: text,
    introAbout: text,
    introConsent: text,
    introSubmit: text,
    introSent: text,
    introError: text,
    you: text,
    agent: text,
  }),
  notFound: z.object({ heading: text, body: text, home: text }),
  sky: z.object({
    label: text,
    weather: text,
    preview: text,
    sun: text,
    details: text,
    updated: text,
    attribution: text,
    attributionHref: url,
    dialog: text,
    scrub: text,
    backToNow: text,
    close: text,
    words: z.object({
      clear: text,
      mostlyClear: text,
      partlyCloudy: text,
      overcast: text,
      foggy: text,
      drizzle: text,
      lightRain: text,
      rain: text,
      heavyRain: text,
      thunderstorm: text,
    }),
  }),
});

export const contentSchema = z.object({
  profile: profileSchema,
  links: linksSchema,
  shipped: z.array(projectSchema).min(1),
  building: z.array(benchSchema),
  caseStudies: z.array(caseStudySchema),
  receipts: z.array(receiptSchema),
  closer: closerSchema,
  principles: z.array(text),
  stack: z.array(text),
  workingStyle: z.array(text),
  services: servicesSchema,
  agentFacts: z.array(agentFactSchema),
  lifts: liftsSchema,
  ui: uiSchema,
});

export type Content = z.infer<typeof contentSchema>;
export type ContentInput = z.input<typeof contentSchema>;
export type Project = z.infer<typeof projectSchema>;
export type BenchItem = z.infer<typeof benchSchema>;
export type CaseStudy = z.infer<typeof caseStudySchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type RoutineDay = z.infer<typeof routineDaySchema>;
