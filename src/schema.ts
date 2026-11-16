import { z } from "zod";

/** Zod schemas for everything in src/content.ts and src/gym.ts. Parsed at module load, so bad content fails the build. */

export const BUS_IDS = ["voice", "agents", "tooling", "apps", "media", "research"] as const;
export const STATUS_IDS = ["shipped", "built", "in-build", "specd", "idea"] as const;
export const LIGHT_STATES = ["on", "off", "amber", "dotted", "red"] as const;
export const BLOCK_IDS = ["now", "next", "later"] as const;
export const WEEKDAY_IDS = ["friday", "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday"] as const;

const text = z.string().trim().min(1);
const projectId = z.string().regex(/^P-\d{2}$/);
const yearMonth = z.string().regex(/^\d{4}-\d{2}$/);
const lights = z.tuple([z.enum(LIGHT_STATES), z.enum(LIGHT_STATES), z.enum(LIGHT_STATES)]);

export const linkSchema = z.object({ label: text, href: text });

export const profileSchema = z.object({
  name: text,
  alias: text,
  monogram: text,
  title: text,
  line: text,
  summary: text,
  location: text,
  hours: text,
  credentials: z.array(text).min(1),
  site: z.url(),
  links: z.object({
    email: linkSchema,
    calendar: linkSchema,
    github: linkSchema,
    linkedin: linkSchema,
  }),
});

export const flightSchema = z.object({
  n: z.string().regex(/^0\d$/),
  id: text,
  name: text,
  plain: text,
  nav: text,
});

export const busSchema = z.object({
  id: z.enum(BUS_IDS),
  name: text,
  stamp: text,
  color: text,
});

export const statusSchema = z.object({
  id: z.enum([...STATUS_IDS, "failed"]),
  name: text,
  call: text,
  plain: text,
  lights,
  rank: z.number().int(),
});

export const metricSchema = z.object({
  id: text,
  lift: text,
  system: text,
  previous: text.nullable(),
  value: text,
  unit: text.nullable(),
  delta: text.nullable(),
  how: text,
  plate: text,
  short: text,
});

export const blockSchema = z.object({
  id: text,
  n: z.number().int().positive(),
  employer: text,
  note: text.nullable(),
  role: text,
  period: text,
  start: yearMonth,
  end: yearMonth.nullable(),
  summary: text,
  trained: z.array(text).min(1),
});

export const caseStudySchema = z.object({
  id: text,
  title: text,
  approach: text,
  flow: z.array(text).min(2),
  result: text,
});

export const projectSchema = z.object({
  id: projectId,
  name: text,
  bus: z.enum(BUS_IDS),
  status: z.enum(STATUS_IDS),
  oneLiner: text,
  detail: text.optional(),
  stack: z.array(text).optional(),
  install: z.array(text).optional(),
  version: text.optional(),
  link: linkSchema.optional(),
  next: text.optional(),
  connectsTo: z.array(projectId).default([]),
});

export const principleSchema = z.object({ rule: text, detail: text.nullable() });

export const tierSchema = z.object({
  tier: text,
  models: text,
  share: text,
  jobs: text.nullable(),
});

export const companySchema = z.object({
  n: text,
  name: text,
  plan: text,
  target: text,
});

export const offerSchema = z.object({
  title: text,
  plain: text,
  pitch: text,
  terms: z.array(z.object({ label: text, value: text })).min(1),
  cta: text,
});

export const goalSchema = z.object({
  lift: text,
  target: text,
  block: z.enum(BLOCK_IDS),
  /** current state: taken from the linked project's status, or stated directly, or counted from data */
  current: z.union([
    z.object({ kind: z.literal("project"), projectId }),
    z.object({ kind: z.literal("text"), text }),
    z.object({ kind: z.literal("count-status"), status: z.enum(STATUS_IDS), suffix: text }),
  ]),
});

export const scenarioSchema = z.object({
  id: text,
  caseStudyId: text,
  situation: text,
  /** display order, as indexes into options, so the real call is not always in the same slot */
  order: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
  options: z
    .array(
      z.object({
        id: z.enum(["a", "b", "c"]),
        label: text,
        actual: z.boolean(),
        tradeOff: text.optional(),
      }),
    )
    .length(3),
  result: text,
});

export const missSchema = z.object({
  name: text,
  projectId: projectId.optional(),
  happened: text,
  adjustment: text,
});

export const gymExerciseSchema = z.object({
  name: text,
  prescription: text,
  note: text.optional(),
});

export const gymDaySchema = z.object({
  id: z.enum(WEEKDAY_IDS),
  weekday: text,
  num: z
    .string()
    .regex(/^0[1-5]$/)
    .optional(),
  lift: text,
  emphasis: text.optional(),
  rest: z.boolean().default(false),
  restLine: text.optional(),
  duration: text.optional(),
  photo: text.optional(),
  exercises: z.array(gymExerciseSchema),
});

// ── Illustrations (written by `pnpm illustrations`) and the garage scene ──

export const PALETTE_CLASSES = ["i-chalk", "i-iron", "i-grey", "i-tan", "i-red", "i-blue", "i-yellow", "i-green", "i-skin"] as const;

const point = z.tuple([z.number(), z.number()]);

export const illustrationPartSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9-]*$/),
  viewBox: z.string().regex(/^0 0 \d+ \d+$/),
  /** intrinsic size in source sheet pixels */
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** top left corner on the source sheet, so parts of one sheet keep their relative scale and position */
  origin: point,
  /** joint or anchor point, normalised to the part's box */
  pivot: point,
  z: z.number().int(),
  bytes: z.number().int().positive(),
});

export const illustrationAssetSchema = z.object({
  id: z.string().regex(/^a\d{2}b?$/),
  source: text,
  /** svg: traced and palette-snapped. webp: keyed cut-outs, the fallback when a trace is too heavy or wobbly */
  format: z.enum(["svg", "webp"]),
  bytes: z.number().int().positive(),
  gzipBytes: z.number().int().positive(),
  parts: z.array(illustrationPartSchema).min(1),
});

export const illustrationManifestSchema = z.record(z.string(), illustrationAssetSchema);

export const stationSchema = z.object({
  id: z.string().regex(/^[a-z][a-z-]*$/),
  /** illustration sheet for this object */
  asset: z.string().regex(/^a\d{2}b?$/),
  /** top left corner and footprint in the 1600 x 900 scene */
  x: z.number().min(0).max(1600),
  y: z.number().min(0).max(900),
  w: z.number().positive(),
  h: z.number().positive(),
  /** scene units per source sheet pixel */
  scale: z.number().positive(),
  z: z.number().int(),
  /** where the station leads. null only for the lamp, which is a control and not a link */
  href: z.string().regex(/^\/[a-z-]*\/(#[a-z-]+)?$/).nullable(),
  label: text,
  plain: text,
  /** the flight (page section) this object stands for, when it stands for one */
  section: text.nullable(),
});

export type Link = z.infer<typeof linkSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type Flight = z.infer<typeof flightSchema>;
export type Bus = z.infer<typeof busSchema>;
export type BusId = (typeof BUS_IDS)[number];
export type Status = z.infer<typeof statusSchema>;
export type StatusId = (typeof STATUS_IDS)[number];
export type LightState = (typeof LIGHT_STATES)[number];
export type Metric = z.infer<typeof metricSchema>;
export type Block = z.infer<typeof blockSchema>;
export type CaseStudy = z.infer<typeof caseStudySchema>;
export type Project = z.infer<typeof projectSchema>;
export type Principle = z.infer<typeof principleSchema>;
export type Tier = z.infer<typeof tierSchema>;
export type Company = z.infer<typeof companySchema>;
export type Offer = z.infer<typeof offerSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type BlockId = (typeof BLOCK_IDS)[number];
export type Scenario = z.infer<typeof scenarioSchema>;
export type Miss = z.infer<typeof missSchema>;
export type GymExercise = z.infer<typeof gymExerciseSchema>;
export type GymDay = z.infer<typeof gymDaySchema>;
export type WeekdayId = (typeof WEEKDAY_IDS)[number];
export type PaletteClass = (typeof PALETTE_CLASSES)[number];
export type IllustrationPart = z.infer<typeof illustrationPartSchema>;
export type IllustrationAsset = z.infer<typeof illustrationAssetSchema>;
export type IllustrationManifest = z.infer<typeof illustrationManifestSchema>;
/** traced layers of one part, bottom first: palette class and path data */
export type IllustrationPaths = Record<string, readonly (readonly [cls: PaletteClass, d: string])[]>;
export type Station = z.infer<typeof stationSchema>;
