/**
 * GES / NaCCA subject mappings per class (D-style, school-defined framework).
 *
 * `getSubjectsForClass` returns the standard subject list for a given class name,
 * including categorized section headers (`isHeading: true`). Used by the GES
 * standard preset to provision subjects and by the report card renderer.
 */

export interface SubjectEntry {
  readonly name: string;
  readonly isHeading?: boolean;
}

export function isHeading(entry: SubjectEntry): boolean {
  return entry.isHeading === true;
}

const CRECHE: SubjectEntry[] = [
  { name: "Communication & Language", isHeading: true },
  { name: "Listening & Speaking" },
  { name: "Early Reading" },
  { name: "Physical Development", isHeading: true },
  { name: "Gross Motor Skills" },
  { name: "Fine Motor Skills" },
  { name: "Personal, Social & Emotional", isHeading: true },
  { name: "Self-Awareness" },
  { name: "Social Skills" },
  { name: "Creative Arts", isHeading: true },
  { name: "Drawing & Colouring" },
  { name: "Music & Movement" },
];

const NURSERY: SubjectEntry[] = [
  { name: "Language & Literacy", isHeading: true },
  { name: "English" },
  { name: "Ghanaian Language" },
  { name: "Mathematics", isHeading: true },
  { name: "Number Work" },
  { name: "Shape & Space" },
  { name: "Our World", isHeading: true },
  { name: "Environmental Studies" },
  { name: "Creative Arts", isHeading: true },
  { name: "Drawing" },
  { name: "Music" },
];

const KG: SubjectEntry[] = [
  { name: "Language & Literacy", isHeading: true },
  { name: "English Language" },
  { name: "Ghanaian Language" },
  { name: "Mathematics", isHeading: true },
  { name: "Number Work" },
  { name: "Measurement" },
  { name: "Our World Our People", isHeading: true },
  { name: "Environmental Studies" },
  { name: "RME" },
  { name: "Creative Arts", isHeading: true },
  { name: "Drawing & Painting" },
  { name: "Music & Drama" },
  { name: "Physical Development", isHeading: true },
  { name: "Physical Education" },
];

const BASIC_LOWER: SubjectEntry[] = [
  { name: "Core Subjects", isHeading: true },
  { name: "English Language" },
  { name: "Mathematics" },
  { name: "Science" },
  { name: "Social Studies" },
  { name: "RME" },
  { name: "Ghanaian Language" },
  { name: "Computing" },
  { name: "Creative Arts", isHeading: true },
  { name: "Music" },
  { name: "Visual Arts" },
  { name: "Physical Education" },
];

const BASIC_UPPER: SubjectEntry[] = [
  { name: "Core Subjects", isHeading: true },
  { name: "English Language" },
  { name: "Mathematics" },
  { name: "Science" },
  { name: "Social Studies" },
  { name: "RME" },
  { name: "Ghanaian Language" },
  { name: "Computing" },
  { name: "French" },
  { name: "UCMAS" },
  { name: "Creative Arts", isHeading: true },
  { name: "Music" },
  { name: "Visual Arts" },
  { name: "Physical Education" },
];

const JHS: SubjectEntry[] = [
  { name: "Core Subjects", isHeading: true },
  { name: "English Language" },
  { name: "Mathematics" },
  { name: "Integrated Science" },
  { name: "Social Studies" },
  { name: "RME" },
  { name: "Ghanaian Language" },
  { name: "French" },
  { name: "Computing" },
  { name: "Creative Arts", isHeading: true },
  { name: "Visual Arts" },
  { name: "Music" },
  { name: "Physical Education" },
];

function normalise(name: string): string {
  return name.trim().toLowerCase();
}

export function getSubjectsForClass(className: string): SubjectEntry[] {
  const key = normalise(className);
  if (key.includes("creche") || key.includes("crèche")) return CRECHE;
  if (key.includes("nursery")) return NURSERY;
  if (key.includes("kg")) return KG;
  if (key.includes("jhs")) return JHS;
  const basicMatch = key.match(/basic\s*(\d+)/);
  if (basicMatch) {
    const level = Number(basicMatch[1]);
    return level >= 4 ? BASIC_UPPER : BASIC_LOWER;
  }
  if (key.includes("basic")) return BASIC_LOWER;
  return BASIC_LOWER;
}