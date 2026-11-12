import { z } from "zod";
import { BUS_IDS, HORIZON_IDS, SHEET_NOS, STATUS_IDS } from "./content.ids";

/**
 * Zod schemas for everything in src/content.ts.
 * Types used by components are inferred from these schemas (import type only),
 * so zod itself never reaches the client bundle.
 */

export { BUS_IDS, HORIZON_IDS, SHEET_NOS, STATUS_IDS };

const text = z.string().trim().min(1);
/** No unresolved [[placeholder]] may ever reach the page. */
const cleanText = text.refine((s) => !s.includes("[[") && !s.includes("]]"), {
  message: "unresolved [[placeholder]]",
});
const url = z.url({ protocol: /^https$/ });

export const busIdSchema = z.enum(BUS_IDS);
export const statusIdSchema = z.enum(STATUS_IDS);
export const horizonIdSchema = z.enum(HORIZON_IDS);
export const sheetNoSchema = z.enum(SHEET_NOS);
export const projectIdSchema = z.string().regex(/^P-\d{2}$/);

export const linkSchema = z.object({
  label: cleanText,
  display: cleanText,
  href: z.union([url, z.string().regex(/^mailto:[^@\s]+@[^@\s]+$/)]),
});

export const profileSchema = z.object({
  name: cleanText,
  alias: cleanText,
  monogram: cleanText,
  title: cleanText,
  roleLine: cleanText,
  summary: cleanText,
  location: cleanText,
  hours: cleanText,
  credentials: z.array(cleanText).min(1),
  drawnBy: cleanText,
});

export const linksSchema = z.object({
  site: linkSchema,
  github: linkSchema,
  linkedin: linkSchema,
  email: linkSchema,
  calendar: linkSchema,
});

export const countSchema = z.object({
  prefix: z.string(),
  value: z.number().nonnegative(),
  suffix: z.string(),
  /** Thousands separators when true. */
  group: z.boolean(),
});

export const metricSchema = z.object({
  id: z.string().regex(/^M-\d{2}$/),
  label: cleanText,
  delta: countSchema,
  deltaUnit: cleanText,
  before: cleanText,
  after: cleanText,
  system: cleanText,
  /** True when the delta is arithmetic on the stated values rather than a quoted figure. */
  derived: z.boolean(),
});

export const experienceSchema = z.object({
  rev: z.string().regex(/^[A-Z]$/),
  from: cleanText,
  /** null = no end date supplied; rendered as an open period, never guessed. */
  to: cleanText.nullable(),
  org: cleanText,
  role: cleanText,
  change: cleanText,
  bullets: z.array(cleanText).min(1),
});

export const caseStudySchema = z.object({
  id: z.string().regex(/^CS-\d{2}$/),
  title: cleanText,
  problem: cleanText,
  built: cleanText,
  flow: z.array(cleanText).min(3).max(6),
  result: cleanText,
});

export const busSchema = z.object({ id: busIdSchema, label: cleanText });

export const statusSchema = z.object({
  id: statusIdSchema,
  label: cleanText,
  line: cleanText,
  meaning: cleanText,
});

export const projectSchema = z.object({
  id: projectIdSchema,
  name: cleanText,
  bus: busIdSchema,
  status: statusIdSchema,
  oneLiner: cleanText,
  detail: cleanText.optional(),
  stack: z.array(cleanText),
  link: linkSchema.optional(),
  install: z.array(cleanText).optional(),
  version: cleanText.optional(),
  /** Next revision. Always drawn in red. */
  redline: cleanText.optional(),
  /** Short form of the redline for the system map (max 18 characters, one slot wide). */
  redlineTag: cleanText.max(18).optional(),
  connectsTo: z.array(projectIdSchema),
});

export const goalSchema = z.object({
  id: z.string().regex(/^G-\d{2}$/),
  horizon: horizonIdSchema,
  text: cleanText,
  target: cleanText.optional(),
  projectIds: z.array(projectIdSchema),
  /** Used when a goal attaches to a company instead of a project. */
  attachesTo: cleanText.optional(),
});

export const goalsSchema = z.object({
  companies: z
    .array(
      z.object({
        id: cleanText,
        name: cleanText,
        body: cleanText,
        target: cleanText,
        projectIds: z.array(projectIdSchema),
      }),
    )
    .length(2),
  offer: z.object({
    title: cleanText,
    rows: z.array(z.object({ label: cleanText, value: cleanText })).min(1),
  }),
  horizons: z.array(z.object({ id: horizonIdSchema, label: cleanText, note: cleanText })).length(3),
  items: z.array(goalSchema).min(1),
});

export const principleSchema = z.object({
  n: z.number().int().positive(),
  title: cleanText,
  body: cleanText.optional(),
});

export const routingTierSchema = z.object({
  tier: cleanText,
  share: z.number().positive(),
  range: cleanText,
  use: cleanText,
});

export const sheetSchema = z.object({
  no: sheetNoSchema,
  title: cleanText,
  heading: cleanText,
  intro: cleanText.optional(),
  rev: z.string().regex(/^[A-Z]$/),
  /** Section level redline: a goal marked on this sheet. Must reference a goal id. */
  redlineGoalId: z
    .string()
    .regex(/^G-\d{2}$/)
    .optional(),
});

export const contentSchema = z.object({
  profile: profileSchema,
  links: linksSchema,
  metrics: z.array(metricSchema).length(6),
  experience: z.array(experienceSchema).min(1),
  caseStudies: z.array(caseStudySchema).length(5),
  buses: z.array(busSchema).length(BUS_IDS.length),
  statuses: z.array(statusSchema).length(STATUS_IDS.length),
  projects: z.array(projectSchema).min(1),
  goals: goalsSchema,
  principles: z.array(principleSchema).min(1),
  stackLine: z.array(cleanText).min(1),
  routing: z.array(routingTierSchema).length(3),
  sheets: z.array(sheetSchema).length(SHEET_NOS.length),
});

export type BusId = z.infer<typeof busIdSchema>;
export type StatusId = z.infer<typeof statusIdSchema>;
export type HorizonId = z.infer<typeof horizonIdSchema>;
export type SheetNo = z.infer<typeof sheetNoSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Links = z.infer<typeof linksSchema>;
export type Count = z.infer<typeof countSchema>;
export type Metric = z.infer<typeof metricSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type CaseStudy = z.infer<typeof caseStudySchema>;
export type Bus = z.infer<typeof busSchema>;
export type Status = z.infer<typeof statusSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Goals = z.infer<typeof goalsSchema>;
export type Principle = z.infer<typeof principleSchema>;
export type RoutingTier = z.infer<typeof routingTierSchema>;
export type SheetMeta = z.infer<typeof sheetSchema>;
export type Content = z.infer<typeof contentSchema>;
