import { z } from "zod";
import { gymDaySchema, type GymDay, type WeekdayId } from "./schema";

// ── Gym split ─────────────────────────────────────────────
// Edit this file to change the split. /gym and every week strip render whatever
// is in GYM_DAYS, in training-week order: Friday (Day 01) first, Thursday (second rest day) last.
// Migrated from the old src/data/gym.ts, which stays the source of truth for sets, reps and photos.

const REST_LINE = "Zero sets. Zero reps. Recover hard.";

export const GYM_DAYS: GymDay[] = z.array(gymDaySchema).length(7).parse([
  {
    id: "friday",
    weekday: "Friday",
    num: "01",
    lift: "Squat",
    emphasis: "(Heavy)",
    duration: "~85-90 min",
    photo: "/images/gym/day-4.jpg",
    exercises: [
      { name: "Barbell Back Squat", prescription: "3 x 5-7" },
      {
        name: "Barbell Hip Thrust",
        prescription: "3 x 8-10",
        note: "start about 10% lighter than fresh, squats come first",
      },
      { name: "Incline DB Press", prescription: "3 x 8-10" },
      { name: "Lat Pulldown", prescription: "3 x 8-10" },
      { name: "DB Lateral Raise", prescription: "3 x 12-15" },
      { name: "Rope Pushdown", prescription: "3 x 10-12" },
      { name: "Decline Crunch", prescription: "3 x 10-12", note: "first cut if the session runs long" },
      { name: "Cable Crunch", prescription: "3 x 12-15" },
      { name: "Hanging Knee Raise", prescription: "3 x 15" },
      { name: "Incline Walk", prescription: "10 min" },
    ],
  },
  {
    id: "saturday",
    weekday: "Saturday",
    num: "02",
    lift: "Bench",
    emphasis: "(Heavy)",
    duration: "~70 min",
    photo: "/images/gym/day-2.jpg",
    exercises: [
      { name: "Barbell Bench Press", prescription: "3 x 5-7" },
      { name: "Wide-Grip Cable Row", prescription: "3 x 10-12" },
      { name: "Straight-Arm Pulldown", prescription: "3 x 12-15" },
      { name: "Seated Leg Curl", prescription: "3 x 10-12" },
      { name: "Cable Lateral Raise", prescription: "3 x 12-15" },
      { name: "Face Pull", prescription: "3 x 15" },
      { name: "Hanging Leg Raise", prescription: "3 x 12-15" },
      { name: "Incline Walk", prescription: "10 min" },
    ],
  },
  {
    id: "sunday",
    weekday: "Sunday",
    lift: "Rest",
    rest: true,
    restLine: REST_LINE,
    photo: "/images/gym/day-7.jpg",
    exercises: [],
  },
  {
    id: "monday",
    weekday: "Monday",
    num: "03",
    lift: "Pull-Up",
    emphasis: "(Heavy)",
    duration: "~70 min",
    photo: "/images/gym/day-1.jpg",
    exercises: [
      { name: "Weighted Pull-Up", prescription: "3 x 6-8" },
      { name: "Machine Chest Press", prescription: "3 x 10-12" },
      { name: "Leg Press", prescription: "3 x 10-12" },
      { name: "DB Lateral Raise", prescription: "4 x 12-15" },
      { name: "Incline DB Curl", prescription: "3 x 8-10" },
      { name: "Side Plank", prescription: "3 x 30-45 sec per side" },
      { name: "Incline Walk", prescription: "10 min" },
    ],
  },
  {
    id: "tuesday",
    weekday: "Tuesday",
    num: "04",
    lift: "OHP",
    emphasis: "(Heavy)",
    duration: "~70 min",
    photo: "/images/gym/day-5.jpg",
    exercises: [
      { name: "Seated DB Overhead Press", prescription: "3 x 6-10", note: "back supported" },
      { name: "Chest-Supported Row", prescription: "3 x 8-10" },
      { name: "DB Shrug", prescription: "3 x 12-15", note: "pause at the top, no rolling" },
      { name: "Leg Extension", prescription: "3 x 10-12" },
      { name: "Rear Delt Cable Flye", prescription: "3 x 15" },
      { name: "Standing Calf Raise", prescription: "3 x 12-15" },
      { name: "Overhead Cable Extension", prescription: "3 x 12-15" },
      { name: "Incline Walk", prescription: "10 min" },
    ],
  },
  {
    id: "wednesday",
    weekday: "Wednesday",
    num: "05",
    lift: "RDL",
    emphasis: "(Heavy)",
    duration: "~75 min",
    photo: "/images/gym/day-6.jpg",
    exercises: [
      { name: "Romanian Deadlift", prescription: "3 x 8-10" },
      { name: "Walking Lunge or Bulgarian Split Squat", prescription: "3 x 10-12 per leg" },
      { name: "Single-Arm DB Row", prescription: "3 x 10-12" },
      { name: "Cable Lateral Raise", prescription: "4 x 12-15" },
      { name: "Incline DB Flye", prescription: "3 x 10-12", note: "first cut if the session runs long" },
      { name: "Lying Leg Curl", prescription: "3 x 10-12" },
      { name: "Seated Calf Raise", prescription: "3 x 12-15" },
      { name: "Hammer Curl", prescription: "3 x 10-12" },
      { name: "Incline Walk", prescription: "10 min" },
    ],
  },
  {
    id: "thursday",
    weekday: "Thursday",
    lift: "Rest",
    rest: true,
    restLine: REST_LINE,
    photo: "/images/gym/day-7.jpg",
    exercises: [],
  },
]);

export const GYM_RULES: string[] = z
  .array(z.string().min(1))
  .parse([
    "Heavy lift first. Compounds to RPE 8.",
    "Top of the range on every set means bump the load.",
    "+2.5 kg upper, +5 kg lower, +2 kg per dumbbell.",
    "DB press holds 6-10 so a jump will not drop below the floor.",
    "Weak grip on RDLs after two weeks means shrugs move to day 2.",
    "Deload on week 6: half the sets, same weights.",
    "8 to 10k steps daily, floor of 5 to 6k on busy days.",
  ]);

/** All visible copy for /gym and the week strips. */
export const GYM_UI = {
  timeZone: "Asia/Dhaka",
  pageTitle: "The Actual Log",
  pagePlain: "my real weekly gym routine",
  metaTitle: "The Actual Log: Shakil's Weekly Training Split",
  metaDescription:
    "The real weekly gym routine behind the portfolio: five training days, two rest days, every exercise with its sets and reps, and the rules that run the split.",
  intro: "Training week runs Friday to Thursday. Five training days, two rest days.",
  back: "Back to the portfolio",
  jump: "Jump to a day",
  day: "Day",
  restDay: "Rest day",
  rest: "Rest",
  today: "Today",
  todayPlain: "today's session",
  weekLabel: "The week",
  weekPlain: "weekly gym routine",
  columns: { exercise: "Exercise", prescription: "Sets x reps", note: "Note" },
  rulesTitle: "Training rules",
  rulesPlain: "how the split is run",
  openLog: "Open the full log",
  openLogPlain: "full weekly routine",
  trainingDays: "training days",
  restDays: "rest days",
  /** shown only when the Lift project has a link */
  liftLine: "Logged with Lift, my gym logging app:",
  photoAlt: "Shakil training in the gym",
} as const;

export const TRAINING_DAY_COUNT = GYM_DAYS.filter((day) => !day.rest).length;
export const REST_DAY_COUNT = GYM_DAYS.filter((day) => day.rest).length;

export function gymDay(id: WeekdayId): GymDay {
  const day = GYM_DAYS.find((entry) => entry.id === id);
  if (!day) throw new Error(`gym.ts: no day "${id}"`);
  return day;
}

/** Headline for a day, e.g. "Squat (Heavy)" or "Rest". */
export function dayHeadline(day: GymDay): string {
  return day.emphasis ? `${day.lift} ${day.emphasis}` : day.lift;
}
