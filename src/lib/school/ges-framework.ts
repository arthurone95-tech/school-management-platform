/**
 * Read-only GES / NaCCA framework reference.
 *
 * The data here backs the "How the GES standard works" disclosure in School
 * settings. It is descriptive only: the preset is fixed and cannot be edited by
 * a school. Sources are the school's legacy GES reference implementation and the
 * published Ghana Education Service / NaCCA assessment guidance.
 */

import { getSubjectsForClass, isHeading } from "./subjects";

export interface GesGradeRow {
  readonly grade: string;
  readonly range: string;
  readonly descriptor: string;
}

export interface GesProficiencyRow {
  readonly range: string;
  readonly descriptor: string;
}

export interface GesReferenceSection {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly points: readonly string[];
  readonly subjects?: readonly string[];
  readonly table?: {
    readonly headers: readonly string[];
    readonly rows: readonly (readonly string[])[];
  };
}

export const GES_CLASS_LEVELS = [
  "Crèche",
  "Nursery 1",
  "Nursery 2",
  "KG 1",
  "KG 2",
  "Basic 1",
  "Basic 2",
  "Basic 3",
  "Basic 4",
  "Basic 5",
  "Basic 6",
  "JHS 1",
  "JHS 2",
  "JHS 3",
] as const;

export const GES_CLASS_SCORE_WEIGHT = 50;
export const GES_EXAM_SCORE_WEIGHT = 50;

/** GES nine-point scale (A1–F9). */
export const GES_GRADE_SCALE: readonly GesGradeRow[] = [
  { grade: "A1", range: "80–100%", descriptor: "Excellent" },
  { grade: "B2", range: "75–79%", descriptor: "Very Good" },
  { grade: "B3", range: "70–74%", descriptor: "Good" },
  { grade: "C4", range: "65–69%", descriptor: "Credit" },
  { grade: "C5", range: "60–64%", descriptor: "Credit" },
  { grade: "C6", range: "55–59%", descriptor: "Credit" },
  { grade: "D7", range: "50–54%", descriptor: "Pass" },
  { grade: "E8", range: "45–49%", descriptor: "Pass" },
  { grade: "F9", range: "0–44%", descriptor: "Fail" },
];

/** Proficiency descriptors used for terminal remarks. */
export const GES_PROFICIENCY: readonly GesProficiencyRow[] = [
  { range: "80–100%", descriptor: "High Proficiency" },
  { range: "70–79%", descriptor: "Proficient" },
  { range: "50–69%", descriptor: "Approaching Proficient" },
  { range: "0–49%", descriptor: "Emerging" },
];

function subjectNames(className: string): string[] {
  return getSubjectsForClass(className)
    .filter((entry) => !isHeading(entry))
    .map((entry) => entry.name);
}

export const GES_REFERENCE_SECTIONS: readonly GesReferenceSection[] = [
  {
    id: "class-structure",
    title: "1. Standard class structure",
    summary:
      "The GES preset provisions the full national class hierarchy from Crèche to JHS 3.",
    points: [
      "Early years: Crèche, Nursery 1–2 (preschool) and KG 1–2 (kindergarten).",
      "Primary: Basic 1–6.",
      "Junior High: JHS 1–3, which are Basic 7–9 in the national numbering.",
      "The class names are fixed in GES mode. Schools cannot rename, add or remove them while the preset is active.",
    ],
  },
  {
    id: "creche",
    title: "2. Crèche developmental assessment",
    summary:
      "Crèche uses developmental rubrics rather than numeric scores or letter grades.",
    points: [
      "Each developmental item is rated VG (Very Good), G (Good) or NH (Needs Help) against the child's observed behaviour.",
      "Items are grouped under Practical, Health, Emotion and Social Development, Cognitive and Language Development, Music, Art and Creativity, and Environmental Studies (Oral).",
      "No class score, exam score or A1–F9 grade is produced for Crèche.",
      "The report card shows the rubric ratings under each heading.",
    ],
  },
  {
    id: "nursery-kg",
    title: "3. Nursery and Kindergarten learning areas",
    summary:
      "Nursery and KG are assessed through learning areas using the same VG / G / NH rubric.",
    points: [
      "Nursery 1–2 and KG 1–2 are early-years classes, so they use rubric ratings rather than numeric totals.",
      "Learning areas cover language, numeracy, creative arts, physical development, environmental studies and social skills.",
      "KG 2 adds Religious & Moral Education to the KG 1 learning areas.",
      "The class teacher records one rating per learning area for the term.",
    ],
    subjects: subjectNames("KG 1"),
  },
  {
    id: "lower-primary",
    title: "4. Lower Primary subjects (Basic 1–3)",
    summary:
      "Basic 1–3 follow the standard NaCCA subject set with the 50/50 class and exam split.",
    points: [
      "Every listed subject carries a class score out of 50 and an exam score out of 50.",
      "The two components are added to give a total out of 100.",
      "UCMAS is included as a school subject alongside the core NaCCA subjects.",
      "Schools cannot edit this list while the GES preset is active.",
    ],
    subjects: subjectNames("Basic 1"),
  },
  {
    id: "upper-primary",
    title: "5. Upper Primary subjects (Basic 4–6)",
    summary:
      "Basic 4–6 keep the Lower Primary subject set and the same 50/50 weighting.",
    points: [
      "The subject list is the same across Basic 1–6.",
      "French, Ghanaian Language, Computing, Creative Arts, RME and Physical Education continue through Basic 6.",
      "Every subject is scored out of 100 and converted to the A1–F9 scale.",
    ],
    subjects: subjectNames("Basic 4"),
  },
  {
    id: "jhs",
    title: "6. Junior High subjects (JHS 1–3)",
    summary:
      "JHS replaces Our World Our People and History with Career Technology and Social Studies.",
    points: [
      "JHS 1–3 correspond to Basic 7–9.",
      "The core subjects remain English Language, Mathematics and Integrated Science.",
      "Career Technology and Social Studies are added at JHS.",
      "French, Ghanaian Language, Computing, Creative Arts, RME and Physical Education continue through JHS 3.",
      "Every subject is scored out of 100 and converted to the A1–F9 scale.",
    ],
    subjects: subjectNames("JHS 1"),
  },
  {
    id: "weighting",
    title: "7. Class score and exam weighting",
    summary:
      "The GES preset uses a fixed 50% class score and 50% exam score for every numeric subject.",
    points: [
      "Class score (continuous assessment) is capped at 50.",
      "Exam score is capped at 50.",
      "Subject total = class score + exam score, capped at 100.",
      "A school cannot change these weights while the GES preset is active; switch to Fully custom to use different weightings.",
    ],
  },
  {
    id: "grading-scale",
    title: "8. Nine-point grading scale (A1–F9)",
    summary: "Each subject total is converted to one of nine GES grades.",
    points: [
      "Grades are calculated from the subject total out of 100.",
      "A1 is the highest grade; F9 is a fail.",
      "Ranges include the lower bound shown.",
    ],
    table: {
      headers: ["Grade", "Range", "Descriptor"],
      rows: GES_GRADE_SCALE.map((row) => [
        row.grade,
        row.range,
        row.descriptor,
      ]),
    },
  },
  {
    id: "proficiency",
    title: "9. Proficiency remarks",
    summary:
      "The terminal report card describes each subject with one of four proficiency bands.",
    points: [
      "Proficiency is derived from the subject total out of 100.",
      "The bands are fixed for the GES preset.",
      "The same remarks are used on the class teacher's subject sheet and the terminal report card.",
    ],
    table: {
      headers: ["Range", "Remark"],
      rows: GES_PROFICIENCY.map((row) => [row.range, row.descriptor]),
    },
  },
  {
    id: "rankings",
    title: "10. Class and subject rankings",
    summary:
      "Positions are calculated from performance, with ties sharing a rank.",
    points: [
      "Class position compares each learner's overall total with the rest of the class.",
      "Subject position compares each learner's total in that subject with the same class.",
      "Ties share the same position (competition ranking): 1st, 2nd, 2nd, 4th.",
      "Rankings are recalculated whenever a result is entered or corrected.",
    ],
  },
  {
    id: "report-card",
    title: "11. Terminal report card",
    summary:
      "The GES terminal report is a fixed A4 layout printed once per learner per term.",
    points: [
      "School header and learner information.",
      "Class position and next term's opening date.",
      "Subject table with class score, exam score, total, position and remarks.",
      "Attendance, conduct, attitude and interest.",
      "Class teacher's remarks, head teacher's remarks and promotion status.",
      "Next term bills breakdown and signature lines.",
      "The layout is read-only in GES mode and prints on a single A4 page.",
    ],
  },
];
