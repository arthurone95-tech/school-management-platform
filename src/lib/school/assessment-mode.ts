/**
 * The two mutually exclusive assessment frameworks a school can use.
 *
 * `ges_standard` is the read-only GES/NaCCA preset (50 + 50 at Basic/JHS);
 * `custom` is a school-defined framework with its own subjects and grade bands.
 * Stored GES and custom records are kept separate rather than reinterpreted
 * when a school changes mode.
 */

export type AssessmentMode = "ges_standard" | "custom";

export const ASSESSMENT_MODES: readonly AssessmentMode[] = [
  "ges_standard",
  "custom",
];

export function isAssessmentMode(value: unknown): value is AssessmentMode {
  return value === "ges_standard" || value === "custom";
}

export function assessmentModeLabel(mode: AssessmentMode): string {
  return mode === "ges_standard"
    ? "GES / NaCCA Standard Preset"
    : "Fully Custom Framework";
}
