// ── Gym split ─────────────────────────────────────────────
// Edit this file to change the split — /gym renders whatever
// is in GYM_DAYS, Monday first through Sunday last.

export interface GymExercise {
  name: string;
  /** e.g. "3 x 5-7" or "15-20 min" — rendered verbatim */
  prescription: string;
  note?: string;
}

export interface GymDay {
  /** lowercase weekday — used for deep links (/gym#monday) */
  id: string;
  weekday: string;
  /** zero-padded watermark number, "01" … "07" */
  num: string;
  /** large serif headline, e.g. "Upper" */
  split: string;
  /** italic accent tail after the headline, e.g. "(Heavy)" */
  emphasis?: string;
  /** rest day: sparse panel, no table */
  rest?: boolean;
  restLine?: string;
  /** rough duration shown in the meta line */
  duration: string;
  exercises: GymExercise[];
}

export const GYM_DAYS: GymDay[] = [
  {
    id: 'monday',
    weekday: 'Monday',
    num: '01',
    split: 'Upper',
    emphasis: '(Heavy)',
    duration: '~60 min',
    exercises: [
      { name: 'Barbell Bench Press', prescription: '3 x 5-7', note: 'RPE 8, leave a rep' },
      { name: 'Weighted Pull-Up', prescription: '3 x 6-8', note: 'bodyweight if needed' },
      { name: 'Overhead DB Press', prescription: '3 x 6-8' },
      { name: 'Chest-Supported Row', prescription: '3 x 8-10' },
      { name: 'DB Lateral Raise', prescription: '3 x 12-15' },
      { name: 'Incline DB Flye', prescription: '2 x 10-12' },
    ],
  },
  {
    id: 'tuesday',
    weekday: 'Tuesday',
    num: '02',
    split: 'Lower',
    emphasis: '(Heavy) + Cardio',
    duration: '~70 min',
    exercises: [
      { name: 'Barbell Back Squat', prescription: '3 x 5-7' },
      { name: 'Romanian Deadlift', prescription: '3 x 8-10' },
      { name: 'Leg Press', prescription: '2 x 10-12' },
      { name: 'Seated Leg Curl', prescription: '2 x 10-12' },
      { name: 'Standing Calf Raise', prescription: '3 x 12-15' },
      { name: 'Incline Walk', prescription: '15-20 min' },
    ],
  },
  {
    id: 'wednesday',
    weekday: 'Wednesday',
    num: '03',
    split: 'Push',
    duration: '~50 min',
    exercises: [
      { name: 'Incline DB Press', prescription: '3 x 8-10' },
      { name: 'Machine Chest Press', prescription: '3 x 10-12' },
      { name: 'DB Lateral Raise', prescription: '4 x 12-15' },
      { name: 'Rope Pushdown', prescription: '3 x 10-12' },
      { name: 'Overhead Cable Extension', prescription: '2 x 12-15' },
    ],
  },
  {
    id: 'thursday',
    weekday: 'Thursday',
    num: '04',
    split: 'Pull',
    duration: '~55 min',
    exercises: [
      { name: 'Lat Pulldown', prescription: '3 x 8-10' },
      { name: 'Wide-Grip Cable Row', prescription: '3 x 10-12' },
      { name: 'Cable Lateral Raise', prescription: '3 x 12-15' },
      { name: 'Face Pull', prescription: '3 x 15' },
      { name: 'Incline DB Curl', prescription: '3 x 8-10' },
      { name: 'Hammer Curl', prescription: '2 x 10-12' },
    ],
  },
  {
    id: 'friday',
    weekday: 'Friday',
    num: '05',
    split: 'Legs',
    emphasis: '+ Cardio',
    duration: '~60 min',
    exercises: [
      { name: 'Barbell Hip Thrust', prescription: '3 x 8-10' },
      { name: 'Leg Extension', prescription: '3 x 10-12' },
      { name: 'Lying Leg Curl', prescription: '2 x 10-12' },
      { name: 'Seated Calf Raise', prescription: '3 x 12-15' },
      { name: 'Incline Walk or Cycle', prescription: '15-20 min' },
    ],
  },
  {
    id: 'saturday',
    weekday: 'Saturday',
    num: '06',
    split: 'Core',
    emphasis: '+ Delts',
    duration: '~45 min',
    exercises: [
      { name: 'Hanging Leg Raise', prescription: '3 x 12-15' },
      { name: 'Decline Crunch', prescription: '3 x 10-12' },
      { name: 'Cable Pallof Press', prescription: '3 x 12 /side' },
      { name: 'Cable Lateral Raise', prescription: '4 x 12-15' },
      { name: 'Rear Delt Cable Flye', prescription: '3 x 15' },
    ],
  },
  {
    id: 'sunday',
    weekday: 'Sunday',
    num: '07',
    split: 'Rest',
    rest: true,
    restLine: 'Zero sets. Zero reps. Recover hard.',
    duration: '',
    exercises: [],
  },
];
