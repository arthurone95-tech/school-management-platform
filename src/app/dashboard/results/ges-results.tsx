"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import { TerminalReportCard } from "@/components/reports/TerminalReportCard";
import type {
  GesClassOption,
  GesLearnerResult,
  GesSheet,
  GesTermOption,
} from "@/lib/academics/ges-types";
import { utcToday } from "@/lib/dates";
import {
  calculateGesResult,
  GES_CLASS_SCORE_MAX,
  GES_EXAM_SCORE_MAX,
  formatGesPosition,
} from "@/lib/school/ges-calculator";
import {
  getSubjectsForClass,
  isHeading,
} from "@/lib/school/subjects";
import type { GesRubric } from "@/lib/academics/ges-types";

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

interface ApiFailure {
  readonly ok: false;
  readonly error: string;
}

type OptionsPayload = {
  readonly ok: true;
  readonly classes: readonly GesClassOption[];
  readonly terms: readonly GesTermOption[];
  readonly sheet: GesSheet | null;
};

type SavePayload = {
  readonly ok: true;
  readonly sheet: GesSheet;
};

type ScoreDraft = Record<
  string,
  { readonly classScore: string; readonly examScore: string }
>;

function defaultTermId(terms: readonly GesTermOption[]): string {
  const today = utcToday();
  const current = terms.find(
    (term) =>
      term.isCurrent && term.startsOn <= today && term.endsOn >= today,
  );
  return current?.id ?? terms.find((term) => term.isCurrent)?.id ?? terms[0]?.id ?? "";
}

async function readResponse<T>(
  response: Response,
): Promise<T | ApiFailure> {
  const payload = (await response.json().catch(() => ({}))) as
    | T
    | { readonly ok?: boolean; readonly error?: string };
  if (!response.ok || (payload as { ok?: boolean }).ok !== true) {
    return {
      ok: false,
      error:
        (payload as { error?: string }).error ??
        "The data could not be loaded.",
    };
  }
  return payload as T;
}

async function loadOptions(
  classId: string,
  termId: string,
): Promise<OptionsPayload | ApiFailure> {
  const params = new URLSearchParams();
  if (classId) params.set("classId", classId);
  if (termId) params.set("termId", termId);

  let response: Response;
  try {
    response = await fetch(
      `/api/staff/results/ges${params.size > 0 ? `?${params.toString()}` : ""}`,
      { headers: { Accept: "application/json" } },
    );
  } catch {
    return { ok: false, error: NETWORK_MESSAGE };
  }
  return readResponse<OptionsPayload>(response);
}

async function saveScores(body: unknown): Promise<SavePayload | ApiFailure> {
  let response: Response;
  try {
    response = await fetch("/api/staff/results/ges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: NETWORK_MESSAGE };
  }
  return readResponse<SavePayload>(response);
}

function readComponent(
  raw: string,
  max: number,
): { readonly value: number | null; readonly error: string | null } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { value: null, error: null };
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    return { value: null, error: `0–${max}` };
  }
  return { value: parsed, error: null };
}

function draftFor(learner: GesLearnerResult): ScoreDraft {
  const draft: ScoreDraft = {};
  for (const subject of learner.subjects) {
    draft[subject.subjectName] = {
      classScore:
        subject.classScore === null ? "" : String(subject.classScore),
      examScore: subject.examScore === null ? "" : String(subject.examScore),
    };
  }
  return draft;
}

export function GesResults({
  schoolName,
  canReadAssessments,
}: {
  readonly schoolName: string | null;
  readonly canReadAssessments: boolean;
}) {
  const [classes, setClasses] = useState<readonly GesClassOption[]>([]);
  const [terms, setTerms] = useState<readonly GesTermOption[]>([]);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [sheet, setSheet] = useState<GesSheet | null>(null);

  const [loading, setLoading] = useState(canReadAssessments);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedLearnerId, setSelectedLearnerId] = useState("");
  const [reportLearnerId, setReportLearnerId] = useState("");
  const [draft, setDraft] = useState<ScoreDraft>({});
  const [rubricDraft, setRubricDraft] = useState<Record<string, GesRubric | null>>({});
  const [draftError, setDraftError] = useState<string | null>(null);

  const initialisedTerm = useRef(false);

  const load = useCallback(async () => {
    if (!canReadAssessments) {
      return;
    }
    const result = await loadOptions(classId, termId);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setClasses(result.classes);
    setTerms(result.terms);
    setSheet(result.sheet);

    if (!initialisedTerm.current && result.terms.length > 0) {
      initialisedTerm.current = true;
      setTermId(defaultTermId(result.terms));
    }
  }, [canReadAssessments, classId, termId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const selectedLearner = useMemo(
    () =>
      sheet?.learners.find((entry) => entry.learnerId === selectedLearnerId) ??
      null,
    [sheet, selectedLearnerId],
  );
  const reportLearner = useMemo(
    () =>
      sheet?.learners.find((entry) => entry.learnerId === reportLearnerId) ??
      null,
    [sheet, reportLearnerId],
  );

  const visibleLearners = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!sheet || query.length === 0) {
      return sheet?.learners ?? [];
    }
    return sheet.learners.filter(
      (learner) =>
        learner.fullName.toLowerCase().includes(query) ||
        learner.registrationNumber.toLowerCase().includes(query),
    );
  }, [sheet, search]);

  function chooseClass(value: string) {
    setClassId(value);
    setSelectedLearnerId("");
    setReportLearnerId("");
    setSheet(null);
    setDraft({});
    setRubricDraft({});
    setDraftError(null);
    setNotice(null);
    setLoading(true);
  }

  function chooseTerm(value: string) {
    setTermId(value);
    setSelectedLearnerId("");
    setReportLearnerId("");
    setSheet(null);
    setDraft({});
    setRubricDraft({});
    setDraftError(null);
    setNotice(null);
    setLoading(true);
  }

  function updateDraft(
    subjectName: string,
    component: "classScore" | "examScore",
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      [subjectName]: {
        classScore: current[subjectName]?.classScore ?? "",
        examScore: current[subjectName]?.examScore ?? "",
        [component]: value,
      },
    }));
  }

  function openLearner(learnerId: string) {
    const learner =
      sheet?.learners.find((entry) => entry.learnerId === learnerId) ?? null;
    setSelectedLearnerId(learnerId);
    setDraft(learner ? draftFor(learner) : {});
    const nextRubric: Record<string, GesRubric | null> = {};
    if (learner) {
      for (const subject of learner.subjects) {
        nextRubric[subject.subjectName] = subject.rubric;
      }
    }
    setRubricDraft(nextRubric);
    setReportLearnerId("");
    setDraftError(null);
    setNotice(null);
  }

  function openReport(learnerId: string) {
    setReportLearnerId(learnerId);
    setNotice(null);
  }

  async function saveSelectedLearner() {
    if (!sheet || !selectedLearner) {
      return;
    }

    const scores = selectedLearner.subjects.map((subject) => {
      const entry = draft[subject.subjectName] ?? {
        classScore: "",
        examScore: "",
      };
      const classResult = readComponent(
        entry.classScore,
        GES_CLASS_SCORE_MAX,
      );
      const examResult = readComponent(entry.examScore, GES_EXAM_SCORE_MAX);
      return {
        subjectName: subject.subjectName,
        classScore: classResult.value,
        examScore: examResult.value,
        error: classResult.error ?? examResult.error,
      };
    });

    const invalid = scores.find((score) => score.error !== null);
    if (invalid) {
      setDraftError(
        `Check the ${invalid.subjectName} score. Class and exam scores must be between 0 and 50.`,
      );
      return;
    }

    setSaving(true);
    setDraftError(null);
    setError(null);
    setNotice(null);

    const result = await saveScores({
      classId: sheet.classId,
      termId: sheet.termId,
      learnerId: selectedLearner.learnerId,
      scores: scores.map((score) => ({
        subjectName: score.subjectName,
        classScore: score.classScore,
        examScore: score.examScore,
      })),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSheet(result.sheet);
    const updated =
      result.sheet.learners.find(
        (entry) => entry.learnerId === selectedLearner.learnerId,
      ) ?? null;
    setDraft(updated ? draftFor(updated) : {});
    setRubricDraft({});
    setNotice(`Saved ${selectedLearner.fullName}'s subject scores.`);
  }

  async function saveEarlyYearsLearner() {
    if (!sheet || !selectedLearner) {
      return;
    }

    setSaving(true);
    setDraftError(null);
    setError(null);
    setNotice(null);

    const result = await saveScores({
      classId: sheet.classId,
      termId: sheet.termId,
      learnerId: selectedLearner.learnerId,
      scores: sheet.subjects.map((subjectName) => ({
        subjectName,
        classScore: null,
        examScore: null,
        rubric: rubricDraft[subjectName] ?? null,
      })),
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSheet(result.sheet);
    const updated =
      result.sheet.learners.find(
        (entry) => entry.learnerId === selectedLearner.learnerId,
      ) ?? null;
    const nextRubric: Record<string, GesRubric | null> = {};
    if (updated) {
      for (const subject of updated.subjects) {
        nextRubric[subject.subjectName] = subject.rubric;
      }
    }
    setRubricDraft(nextRubric);
    setNotice(`Saved ${selectedLearner.fullName}'s qualitative ratings.`);
  }

  const activeClasses = classes.filter((klass) => klass.isActive);
  const reportSubjects = reportLearner
    ? reportLearner.subjects.map((subject) => ({
        name: subject.subjectName,
        classScore: subject.classScore,
        examScore: subject.examScore,
        totalScore: subject.totalScore,
        position: subject.position,
        remarks: subject.proficiency,
        grade: subject.grade,
        rubric: subject.rubric,
      }))
    : [];

  return (
    <div className="container stack">
      <div className="stack stack--sm">
        <h1>GES terminal results</h1>
        <p className="muted">
          The official GES / NaCCA 50 + 50 model: a class score out of 50 and an
          exam score out of 50. The total, grade, proficiency remark and class
          positions are calculated from the saved marks. Only the classes you are
          assigned to appear here.
        </p>
      </div>

      {!canReadAssessments ? (
        <Alert variant="warning">
          You do not have permission to view assessment results.
        </Alert>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      <Card>
        <CardHeader
          title="Choose a class and term"
          description="GES results are stored separately for each term so a past terminal report is not rewritten."
        />
        <CardBody>
          <div className="form-grid">
            <SelectField
              label="Class"
              required
              value={classId}
              onChange={(event) => chooseClass(event.target.value)}
              options={[
                { value: "", label: "Choose a class" },
                ...activeClasses.map((klass) => ({
                  value: klass.id,
                  label: klass.name,
                })),
              ]}
            />
            <SelectField
              label="Term"
              required
              value={termId || sheet?.termId || ""}
              onChange={(event) => chooseTerm(event.target.value)}
              options={[
                { value: "", label: "Choose a term" },
                ...terms.map((term) => ({
                  value: term.id,
                  label: `${term.academicYearName} — ${term.name}`,
                })),
              ]}
              disabled={terms.length === 0}
            />
          </div>
          {terms.length === 0 ? (
            <p className="muted" style={{ marginTop: "0.75rem" }}>
              No academic terms are configured. An administrator must set up the
              academic year and its terms before GES results can be recorded.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {loading ? (
        <p className="muted" role="status">
          Loading the GES sheet…
        </p>
      ) : null}

      {!loading && classId && terms.length > 0 && sheet === null ? (
        <Alert variant="info">
          Choose a term to load this class&rsquo;s terminal sheet.
        </Alert>
      ) : null}

      {sheet?.earlyYears ? (
        <Alert variant="info">
          {sheet.className} is an early-years class. Crèche, Nursery and
          Kindergarten use developmental rubrics (VG/G/NH), not the Basic/JHS
          50 + 50 numeric sheet, so a numeric terminal report is not available
          here.
        </Alert>
      ) : null}

      {sheet && !sheet.earlyYears ? (
        <>
          <Card>
            <CardHeader
              title={`${sheet.className} — ${sheet.termName}`}
              description={`${sheet.academicYearName}. ${sheet.learners.length} learner${sheet.learners.length === 1 ? "" : "s"}; ${sheet.subjects.length} official subjects.`}
            />
            <CardBody>
              <TextField
                label="Find a learner"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or registration number"
              />
              {!sheet.isEditable ? (
                <p className="muted" style={{ marginTop: "0.75rem" }}>
                  Read-only. Recording GES marks requires both result.record and
                  assessment.manage.
                </p>
              ) : null}
            </CardBody>
            <ul className="record-list">
              {visibleLearners.length === 0 ? (
                <li className="record">
                  <div className="record__main">
                    <p className="record__title">No learners match.</p>
                  </div>
                </li>
              ) : (
                visibleLearners.map((learner) => (
                  <li className="record" key={learner.learnerId}>
                    <div className="record__main">
                      <p className="record__title">{learner.fullName}</p>
                      <p className="record__meta">
                        <span>{learner.registrationNumber}</span>
                        <span>
                          Total:{" "}
                          {learner.totalScore === null
                            ? "–"
                            : learner.totalScore.toFixed(1)}
                        </span>
                        <span>Position: {formatGesPosition(learner.position)}</span>
                        <span>
                          {learner.markedSubjects}/{learner.subjects.length}{" "}
                          subjects marked
                        </span>
                        {learner.isComplete ? (
                          <span className="badge badge--accepted">Complete</span>
                        ) : (
                          <span className="badge badge--pending">In progress</span>
                        )}
                      </p>
                    </div>
                    <div className="record__actions">
                      <Button
                        size="sm"
                        variant={
                          selectedLearnerId === learner.learnerId
                            ? "primary"
                            : "secondary"
                        }
                        onClick={() => openLearner(learner.learnerId)}
                      >
                        Enter scores
                      </Button>
                      {!sheet.earlyYears ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openReport(learner.learnerId)}
                        >
                          Report card
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </Card>

          {selectedLearner && !sheet?.earlyYears ? (
            <Card>
              <CardHeader
                title={`Subject scores — ${selectedLearner.fullName}`}
                description={`${selectedLearner.registrationNumber}. Enter the class score out of 50 and the exam score out of 50.`}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedLearnerId("");
                      setDraft({});
                      setDraftError(null);
                    }}
                  >
                    Close
                  </Button>
                }
              />
              <CardBody>
                {draftError ? <Alert variant="error">{draftError}</Alert> : null}
                <div className="ges-score-table-wrap">
                  <table className="ges-score-table">
                    <thead>
                      <tr>
                        <th scope="col">Subject</th>
                        <th scope="col">Class / {GES_CLASS_SCORE_MAX}</th>
                        <th scope="col">Exam / {GES_EXAM_SCORE_MAX}</th>
                        <th scope="col">Total / 100</th>
                        <th scope="col">Grade</th>
                        <th scope="col">Proficiency</th>
                        <th scope="col">Position</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLearner.subjects.map((subject) => {
                        const entry = draft[subject.subjectName] ?? {
                          classScore: "",
                          examScore: "",
                        };
                        const classResult = readComponent(
                          entry.classScore,
                          GES_CLASS_SCORE_MAX,
                        );
                        const examResult = readComponent(
                          entry.examScore,
                          GES_EXAM_SCORE_MAX,
                        );
                        const calculated = calculateGesResult(
                          classResult.value,
                          examResult.value,
                        );
                        return (
                          <tr key={subject.subjectName}>
                            <th scope="row">{subject.subjectName}</th>
                            <td>
                              <input
                                className="field__input ges-score-input"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={GES_CLASS_SCORE_MAX}
                                step="0.01"
                                value={entry.classScore}
                                onChange={(event) =>
                                  updateDraft(
                                    subject.subjectName,
                                    "classScore",
                                    event.target.value,
                                  )
                                }
                                aria-label={`${subject.subjectName} class score`}
                                aria-invalid={classResult.error ? true : undefined}
                                disabled={!sheet.isEditable || saving}
                              />
                              {classResult.error ? (
                                <span className="field__error">
                                  {classResult.error}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              <input
                                className="field__input ges-score-input"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                max={GES_EXAM_SCORE_MAX}
                                step="0.01"
                                value={entry.examScore}
                                onChange={(event) =>
                                  updateDraft(
                                    subject.subjectName,
                                    "examScore",
                                    event.target.value,
                                  )
                                }
                                aria-label={`${subject.subjectName} exam score`}
                                aria-invalid={examResult.error ? true : undefined}
                                disabled={!sheet.isEditable || saving}
                              />
                              {examResult.error ? (
                                <span className="field__error">
                                  {examResult.error}
                                </span>
                              ) : null}
                            </td>
                            <td>{calculated.totalScore ?? "–"}</td>
                            <td>{calculated.grade ?? "–"}</td>
                            <td>{calculated.proficiency ?? "–"}</td>
                            <td>{formatGesPosition(subject.position)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="cluster" style={{ marginTop: "0.75rem" }}>
                  <Button
                    onClick={() => void saveSelectedLearner()}
                    loading={saving}
                    disabled={!sheet.isEditable}
                  >
                    Save learner scores
                  </Button>
                  <span className="muted">
                    Position updates after saving, when the whole class is
                    re-ranked.
                  </span>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {selectedLearner && sheet?.earlyYears ? (
            <Card>
              <CardHeader
                title={`Qualitative ratings - ${selectedLearner.fullName}`}
                description={`${selectedLearner.registrationNumber}. Use VG (Very Good), G (Good), or NH (Needs Help) for each learning area.`}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedLearnerId("");
                      setRubricDraft({});
                      setDraftError(null);
                    }}
                  >
                    Close
                  </Button>
                }
              />
              <CardBody>
                {draftError ? <Alert variant="error">{draftError}</Alert> : null}
                <div className="ges-rubric-list">
                  {getSubjectsForClass(sheet.className).map((entry, index) => {
                    if (isHeading(entry)) {
                      return (
                        <div key={`heading-${entry.name}-${index}`} className="ges-rubric-heading">
                          {entry.name}
                        </div>
                      );
                    }
                    const value = rubricDraft[entry.name] ?? null;
                    return (
                      <div key={entry.name} className="ges-rubric-row">
                        <span className="ges-rubric-subject">{entry.name}</span>
                        <div className="ges-rubric-options">
                          {(["VG", "G", "NH"] as const).map((option) => (
                            <label key={option} className="ges-rubric-option">
                              <input
                                type="radio"
                                name={`rubric-${entry.name}`}
                                value={option}
                                checked={value === option}
                                onChange={() =>
                                  setRubricDraft((current) => ({
                                    ...current,
                                    [entry.name]: option,
                                  }))
                                }
                                disabled={!sheet.isEditable || saving}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() =>
                              setRubricDraft((current) => ({
                                ...current,
                                [entry.name]: null,
                              }))
                            }
                            disabled={!sheet.isEditable || saving}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="cluster" style={{ marginTop: "0.75rem" }}>
                  <Button
                    onClick={() => void saveEarlyYearsLearner()}
                    loading={saving}
                    disabled={!sheet.isEditable}
                  >
                    Save qualitative ratings
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          {reportLearner ? (
            <Card>
              <CardHeader
                title={`Terminal report card — ${reportLearner.fullName}`}
                description="The official GES terminal report sheet. Use Print to produce an A4 copy."
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => window.print()}
                    >
                      Print report card
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setReportLearnerId("")}
                    >
                      Close
                    </Button>
                  </>
                }
              />
              <CardBody>
                <TerminalReportCard
                  schoolName={schoolName ?? "School"}
                  studentName={reportLearner.fullName}
                  className={sheet.className}
                  positionInClass={reportLearner.position}
                  nextTermBegins={sheet.nextTermBegins}
                  term={sheet.termName}
                  academicYear={sheet.academicYearName}
                  createdAt={new Date().toISOString()}
                  subjects={reportSubjects}
                  bills={{}}
                  earlyYears={sheet.earlyYears}
                />
              </CardBody>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
