// ── Gym split ─────────────────────────────────────────────
// Edit this file to change the split — /gym renders whatever
// is in GYM_DAYS, in training-week order: Friday (Day 1)
// first through Thursday (second rest day) last.

export interface GymExercise {
  name: string;
  /** e.g. "3 x 5-7" or "10 min" — rendered verbatim */
  prescription: string;
  note?: string;
}

export interface GymDay {
  /** lowercase weekday — used for deep links (/gym#friday) */
  id: string;
  weekday: string;
  /** zero-padded watermark number, "01" … "05" — the training-day
      counter D1…D5; omitted on rest days, which carry no number */
  num?: string;
  /** large serif headline, e.g. "Squat" */
  split: string;
  /** italic accent tail after the headline, e.g. "(Heavy)" */
  emphasis?: string;
  /** rest day: sparse panel, no table */
  rest?: boolean;
  restLine?: string;
  /** micro lines under the rest line, e.g. program-wide rules */
  rules?: string[];
  /** rough duration shown in the meta line */
  duration: string;
  /** optional photo shown as the panel's dimmed background, e.g. "/images/gym/day-1.jpg" */
  photo?: string;
  /** overlay strength for the photo, 0–1 — lower = more visible photo (default 1) */
  photoDim?: number;
  exercises: GymExercise[];
}

export const GYM_DAYS: GymDay[] = [
  {
    id: 'friday',
    weekday: 'Friday',
    num: '01',
    split: 'Squat',
    emphasis: '(Heavy)',
    duration: '~70 min',
    photo: '/images/gym/day-4.jpg',
    exercises: [
      { name: 'Barbell Back Squat', prescription: '3 x 5-7' },
      { name: 'Barbell Hip Thrust', prescription: '3 x 8-10' },
      { name: 'Incline DB Press', prescription: '3 x 8-10' },
      { name: 'Lat Pulldown', prescription: '3 x 8-10' },
      { name: 'DB Lateral Raise', prescription: '3 x 12-15' },
      { name: 'Rope Pushdown', prescription: '3 x 10-12' },
      { name: 'Incline Walk', prescription: '10 min' },
    ],
  },
  {
    id: 'saturday',
    weekday: 'Saturday',
    num: '02',
    split: 'Bench',
    emphasis: '(Heavy)',
    duration: '~65 min',
    photo: '/images/gym/day-2.jpg',
    exercises: [
      { name: 'Barbell Bench Press', prescription: '3 x 5-7' },
      { name: 'Wide-Grip Cable Row', prescription: '3 x 10-12' },
      { name: 'Seated Leg Curl', prescription: '2 x 10-12' },
      { name: 'Cable Lateral Raise', prescription: '3 x 12-15' },
      { name: 'Face Pull', prescription: '3 x 15' },
      { name: 'Hanging Leg Raise', prescription: '3 x 12-15' },
      { name: 'Incline Walk', prescription: '10 min' },
    ],
  },
  {
    id: 'sunday',
    weekday: 'Sunday',
    split: 'Rest',
    rest: true,
    restLine: 'Zero sets. Zero reps. Recover hard.',
    duration: '',
    photo: '/images/gym/day-7.jpg',
    photoDim: 0.62,
    exercises: [],
  },
  {
    id: 'monday',
    weekday: 'Monday',
    num: '03',
    split: 'Pull-Up',
    emphasis: '(Heavy)',
    duration: '~70 min',
    photo: '/images/gym/day-1.jpg',
    exercises: [
      { name: 'Weighted Pull-Up', prescription: '3 x 6-8' },
      { name: 'Machine Chest Press', prescription: '3 x 10-12' },
      { name: 'Leg Press', prescription: '2 x 10-12' },
      { name: 'DB Lateral Raise', prescription: '4 x 12-15' },
      { name: 'Incline DB Curl', prescription: '3 x 8-10' },
      { name: 'Cable Pallof Press', prescription: '3 x 12 /side' },
      { name: 'Incline Walk', prescription: '10 min' },
    ],
  },
  {
    id: 'tuesday',
    weekday: 'Tuesday',
    num: '04',
    split: 'OHP',
    emphasis: '(Heavy)',
    duration: '~65 min',
    photo: '/images/gym/day-5.jpg',
    exercises: [
      { name: 'Overhead DB Press', prescription: '3 x 6-8' },
      { name: 'Chest-Supported Row', prescription: '3 x 8-10' },
      { name: 'Leg Extension', prescription: '3 x 10-12' },
      { name: 'Rear Delt Cable Flye', prescription: '3 x 15' },
      { name: 'Standing Calf Raise', prescription: '3 x 12-15' },
      { name: 'Hammer Curl', prescription: '2 x 10-12' },
      { name: 'Incline Walk', prescription: '10 min' },
    ],
  },
  {
    id: 'wednesday',
    weekday: 'Wednesday',
    num: '05',
    split: 'RDL',
    emphasis: '(Heavy)',
    duration: '~75 min',
    photo: '/images/gym/day-6.jpg',
    exercises: [
      { name: 'Romanian Deadlift', prescription: '3 x 8-10' },
      { name: 'Incline DB Flye', prescription: '2 x 10-12' },
      { name: 'Cable Lateral Raise', prescription: '4 x 12-15' },
      { name: 'Lying Leg Curl', prescription: '2 x 10-12' },
      { name: 'Overhead Cable Extension', prescription: '2 x 12-15' },
      { name: 'Decline Crunch', prescription: '3 x 10-12' },
      { name: 'Seated Calf Raise', prescription: '3 x 12-15' },
      { name: 'Incline Walk', prescription: '10 min' },
    ],
  },
  {
    id: 'thursday',
    weekday: 'Thursday',
    split: 'Rest',
    rest: true,
    restLine: 'Zero sets. Zero reps. Recover hard.',
    rules: [
      'heavy lift first · compounds to RPE 8',
      'top of the range every set → bump the load',
      '+2.5 kg upper · +5 kg lower · +2 kg per db',
      'deload week 6 — half the sets, same weights',
      '8–10k steps daily · floor of 5–6k on busy days',
    ],
    duration: '',
    photo: '/images/gym/day-7.jpg',
    photoDim: 0.62,
    exercises: [],
  },
];
