/**
 * GES / NaCCA subject mappings per class.
 *
 * These lists mirror the established school framework: Crèche developmental
 * rubrics, Nursery and Kindergarten learning areas, Basic 1–6 and JHS 1–3.
 * `getSubjectsForClass` is the single source of truth used by the GES preset,
 * the assessment reference viewer and the terminal report card.
 */

export interface SubjectEntry {
  readonly name: string;
  readonly isHeading?: boolean;
}

const CRECHE_HEADINGS = new Set<string>([
  "PRACTICAL",
  "HEALTH",
  "EMOTION AND SOCIAL DEVELOPMENT",
  "COGNITIVE AND LANGUAGE DEVELOPMENT",
  "MUSIC, ART AND CREATIVITY",
  "ENVIRONMENTAL STUDIES (ORAL)",
]);

/** Crèche is assessed with developmental rubrics, not numeric scores. */
const CRECHE: readonly string[] = [
  "PRACTICAL",
  "Fine Motor Skills",
  "Care of Others",
  "Care of Environment",
  "Grace Courtesy and Component",
  "HEALTH",
  "Wears Clean Clothes",
  "Good Control of Bladder",
  "Attends Toilet at Acceptable Places and Times",
  "Eats Tidily and Independently",
  "Washes and Cleans Hands",
  "EMOTION AND SOCIAL DEVELOPMENT",
  "Remains Cheerful",
  "Mixes With Others and Show Co-Operation",
  "Shows Confidence During Different Situations",
  "Shows Aggression",
  "Takes Responsibility and Indicates Self-Discipline",
  "COGNITIVE AND LANGUAGE DEVELOPMENT",
  "Concentration-Follows Activity to Conclusion",
  "Can Recite Rhymes and Recall Stories",
  "Tell Name, Sex, Age and Common Objects",
  "Solves Simple Puzzles",
  "Can compare Lengths and Heights",
  "Can Identify and Pair Objects That Are The Same",
  "Scribbles and Write the Numerals from .............To ............",
  "Scribble / Write Letters of The Alphabets",
  "Describe Pictures",
  "Can Count from ...........To.....",
  "Sorts and Group Objects According to Colour, Size, Texture, Shapes, Kinds, Etc.",
  "MUSIC, ART AND CREATIVITY",
  "Enjoys Music, Dancing Dramatization, Modeling and Moulding",
  "Can Draw Man With Three Parts and Enjoys Colouring",
  "ENVIRONMENTAL STUDIES (ORAL)",
  "Can Mention Sources of Water",
  "Can Mention Uses of Water",
  "Can Mention Items Used for Keeping the Environment Clean",
  "Can Identify Parts of The Body",
  "Can State Some Functions of The Parts of The Body",
];

const NURSERY: readonly string[] = [
  "Language Arts",
  "Numeracy",
  "Creative Arts",
  "Physical Development",
  "Environmental Studies",
  "Social Skills",
  "Music & Movement",
];

const KG_1: readonly string[] = [
  "English Language",
  "Mathematics",
  "Science",
  "Creative Arts",
  "Our World Our People",
  "Physical Education",
  "Ghanaian Language",
];

const KG_2: readonly string[] = [
  ...KG_1,
  "Religious & Moral Education",
];

const BASIC: readonly string[] = [
  "ENGLISH LANGUAGE",
  "MATHEMATICS",
  "UCMAS",
  "INTEGRATED SCIENCE",
  "OUR WORLD OUR PEOPLE",
  "HISTORY",
  "CREATIVE ARTS",
  "RELIGIOUS & MORAL EDU.",
  "COMPUTING",
  "GHANAIAN LANGUAGE",
  "FRENCH",
  "PHYSICAL EDUCATION (P.E)",
];

const JHS: readonly string[] = [
  "ENGLISH LANGUAGE",
  "MATHEMATICS",
  "UCMAS",
  "INTEGRATED SCIENCE",
  "CAREER TECHNOLOGY",
  "SOCIAL STUDIES",
  "CREATIVE ARTS",
  "RELIGIOUS & MORAL EDU.",
  "COMPUTING",
  "GHANAIAN LANGUAGE",
  "FRENCH",
  "PHYSICAL EDUCATION (P.E)",
];

/** True when the entry is a category heading rather than an assessable item. */
export function isHeading(entry: SubjectEntry | string): boolean {
  const name = typeof entry === "string" ? entry : entry.name;
  return CRECHE_HEADINGS.has(name);
}

function normalise(className: string): string {
  return className
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toEntries(subjects: readonly string[]): SubjectEntry[] {
  return subjects.map((name) => ({ name, isHeading: CRECHE_HEADINGS.has(name) }));
}

/**
 * True for Crèche, Nursery and Kindergarten classes. Those levels use
 * developmental rubrics rather than the Basic/JHS 50 + 50 numeric model.
 */
export function isEarlyYearsClass(className: string): boolean {
  const key = normalise(className);
  return (
    key.includes("creche") ||
    key.includes("nursery") ||
    key.startsWith("kg") ||
    key.includes("kindergarten")
  );
}

/** The assessable (non-heading) subject names for a class. */
export function getAssessableSubjectsForClass(className: string): string[] {
  return getSubjectsForClass(className)
    .filter((entry) => !isHeading(entry))
    .map((entry) => entry.name);
}

/**
 * Returns the standard subjects for a class name. Accepts display names
 * ("Basic 4", "JHS 2", "Crèche") and stored keys ("basic4", "jhs2", "creche").
 */
export function getSubjectsForClass(className: string): SubjectEntry[] {
  const key = normalise(className);

  if (key.includes("creche")) return toEntries(CRECHE);
  if (key.includes("nursery")) return toEntries(NURSERY);
  if (key.startsWith("kg2") || key.includes("kindergarten2")) {
    return toEntries(KG_2);
  }
  if (key.startsWith("kg1") || key.includes("kindergarten1")) {
    return toEntries(KG_1);
  }
  if (key.includes("jhs")) return toEntries(JHS);
  if (key.includes("basic")) return toEntries(BASIC);
  // KG 2 before KG 1, because "kg" alone should not match the wrong level.
  if (key.includes("kg")) return toEntries(KG_1);
  return toEntries(BASIC);
}
