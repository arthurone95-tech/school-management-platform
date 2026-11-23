"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { TerminalReportCard, type TerminalSubject } from "@/components/reports/TerminalReportCard";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField, TextField } from "@/components/ui/form";
import {
  parseAssessmentCreateInput,
  parseResultSubmitInput,
} from "@/lib/academics/requests";
import type {
  AssessmentSummary,
  ClassAcademicReport,
  ResultSheet,
} from "@/lib/academics/types";
import { utcToday } from "@/lib/dates";
import type {
  AttendanceClassOption,
  AttendanceSubjectOption,
} from "@/lib/attendance/types";
import { roleLabel } from "@/lib/staff/roles";

/**
 * Results (D-031).
 *
 * Three areas, shown according to what the gate established:
 *
 *   * **Set an assessment** (`assessment.manage`). Name, maximum score and date
 *     for a class, optionally for one of the caller's subjects.
 *   * **Record marks** (`result.record`). The sheet is submitted whole, like a
 *     register: a partial sheet would look the same as a complete one. Each row
 *     shows the score, its percentage and the grade the school's own bands give
 *     it. With no bands configured the grade is shown as "no scale configured"
 *     rather than an invented threshold.
 *   * **Class summary** (`report.read`, administrators). Per-assessment averages
 *     and a per-learner row.
 *
 * The interface reuses the server's own parsers, so it cannot submit something
 * the API would reject. It is still not an authorization boundary: the routes and
 * the `can_access_class` policy decide what is allowed
 * (docs/API_DOCUMENTATION.md 14).
 */

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

interface ApiFailure {
  readonly ok: false;
  readonly message: string;
}

async function getJson<T>(
  url: string,
  key: string,
): Promise<{ ok: true; value: T } | ApiFailure> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
  } & Record<string, unknown>;
  if (!response.ok || payload.ok !== true) {
    return {
      ok: false,
      message:
        typeof payload["error"] === "string"
          ? payload["error"]
          : "The data could not be loaded.",
    };
  }
  if (payload[key] === undefined) {
    return { ok: false, message: "The data could not be loaded." };
  }
  return { ok: true, value: payload[key] as T };
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: true } | ApiFailure> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
  };
  if (!response.ok || payload.ok !== true) {
    return {
      ok: false,
      message:
        typeof payload.error === "string"
          ? payload.error
          : "The change could not be saved.",
    };
  }
  return { ok: true };
}

type Scores = Record<string, { score: string; remark: string }>;

export function ResultsClient({
  email,
  role,
  schoolName,
  canReadAssessments,
  canManageAssessments,
  canRecordResults,
  canReadReport,
  canExportReport,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canReadAssessments: boolean;
  readonly canManageAssessments: boolean;
  readonly canRecordResults: boolean;
  readonly canReadReport: boolean;
  readonly canExportReport: boolean;
}) {
  const router = useRouter();
  const today = utcToday();

  const [classes, setClasses] = useState<AttendanceClassOption[]>([]);
  const [subjects, setSubjects] = useState<AttendanceSubjectOption[]>([]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(
    null,
  );
  const [sheet, setSheet] = useState<ResultSheet | null>(null);
  const [scores, setScores] = useState<Scores>({});
  const [rosterSearch, setRosterSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [report, setReport] = useState<ClassAcademicReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLearnerId, setReportLearnerId] = useState("");
  const [reportSubjects, setReportSubjects] = useState<TerminalSubject[] | null>(
    null,
  );
  const [reportCardLoading, setReportCardLoading] = useState(false);

  const [exportFrom, setExportFrom] = useState(() =>
    new Date(Date.parse(`${today}T00:00:00Z`) - 90 * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
  const [exportTo, setExportTo] = useState(today);

  const [newName, setNewName] = useState("");
  const [newMax, setNewMax] = useState("100");
  const [newDate, setNewDate] = useState(today);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // These two fetchers deliberately do not touch state. An effect that awaits one
  // and then sets state avoids the synchronous-setState-in-effect problem, and
  // the `cancelled` flag stops a slow response overwriting a newer one.
  const fetchOptions = useCallback(async (nextClassId: string) => {
    const params = new URLSearchParams();
    if (nextClassId) {
      params.set("classId", nextClassId);
    }
    const query = params.toString();
    let response: Response;
    try {
      response = await fetch(
        `/api/staff/attendance/options${query ? `?${query}` : ""}`,
        { headers: { Accept: "application/json" } },
      );
    } catch {
      return { ok: false as const, message: NETWORK_MESSAGE };
    }
    const payload = (await response.json().catch(() => ({}))) as {
      readonly ok?: boolean;
      readonly error?: string;
      readonly classes?: AttendanceClassOption[];
      readonly subjects?: AttendanceSubjectOption[];
    };
    if (!response.ok || payload.ok !== true) {
      return {
        ok: false as const,
        message:
          typeof payload.error === "string"
            ? payload.error
            : "The data could not be loaded.",
      };
    }
    return {
      ok: true as const,
      value: {
        classes: payload.classes ?? [],
        subjects: payload.subjects ?? [],
      },
    };
  }, []);

  const fetchAssessments = useCallback(
    async (nextClassId: string) => {
      if (!canReadAssessments || !nextClassId) {
        return { ok: true as const, value: [] as AssessmentSummary[] };
      }
      return getJson<AssessmentSummary[]>(
        `/api/staff/assessments?classId=${encodeURIComponent(nextClassId)}`,
        "assessments",
      );
    },
    [canReadAssessments],
  );

  const loadAssessments = useCallback(
    async (nextClassId: string) => {
      const result = await fetchAssessments(nextClassId);
      if (result.ok) {
        setAssessments(result.value);
      } else {
        setError(result.message);
        setAssessments(null);
      }
    },
    [fetchAssessments],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchOptions(classId);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setClasses(result.value.classes);
        setSubjects(result.value.subjects);
      } else {
        // A caller without attendance.read is not necessarily refused everything
        // here; an empty picker is the correct fallback rather than an error.
        setClasses([]);
        setSubjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchOptions, classId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchAssessments(classId);
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setAssessments(result.value);
      } else {
        setError(result.message);
        setAssessments(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAssessments, classId]);

  function selectClass(nextClassId: string) {
    setClassId(nextClassId);
    setSubjectId("");
    setReport(null);
    setReportLearnerId("");
    setReportSubjects(null);
    setNotice(null);
    setError(null);
    setSheet(null);
    setScores({});
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/staff/sign-out", { method: "POST" });
    } catch {
      // Best effort; the redirect below still applies.
    }
    router.replace("/sign-in");
    router.refresh();
  }

  // --- create an assessment -------------------------------------------------

  async function createAssessmentSheet(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const parsed = parseAssessmentCreateInput(
      {
        classId,
        subjectId,
        name: newName,
        maxScore: Number(newMax),
        assessedOn: newDate,
      },
      today,
    );
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    const created = await postJson("/api/staff/assessments", {
      classId: parsed.value.classId,
      subjectId: parsed.value.subjectId,
      name: parsed.value.name,
      maxScore: parsed.value.maxScore,
      assessedOn: parsed.value.assessedOn,
    });
    if (!created.ok) {
      setError(created.message);
      return;
    }

    setNewName("");
    setNotice("Assessment created. Open it to record marks.");
    await loadAssessments(classId);
  }

  async function retireAssessment(assessmentId: string) {
    setError(null);
    setNotice(null);
    const done = await postJson("/api/staff/assessments/update", {
      assessmentId,
      isActive: false,
    });
    if (!done.ok) {
      setError(done.message);
      return;
    }
    setNotice("Assessment retired. Its marks are kept.");
    await loadAssessments(classId);
  }

  // --- mark a sheet ---------------------------------------------------------

  async function openSheet(assessmentId: string) {
    setError(null);
    setNotice(null);

    const result = await getJson<ResultSheet>(
      `/api/staff/results?assessmentId=${encodeURIComponent(assessmentId)}`,
      "sheet",
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSheet(result.value);
    const seeded: Scores = {};
    for (const entry of result.value.entries) {
      seeded[entry.learnerId] = {
        score: entry.score === null ? "" : String(entry.score),
        remark: entry.remark ?? "",
      };
    }
    setScores(seeded);
  }

  function setScore(learnerId: string, value: string) {
    setScores((current) => ({
      ...current,
      [learnerId]: { score: value, remark: current[learnerId]?.remark ?? "" },
    }));
  }

  function setRemark(learnerId: string, value: string) {
    setScores((current) => ({
      ...current,
      [learnerId]: { score: current[learnerId]?.score ?? "", remark: value },
    }));
  }

  async function saveSheet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sheet) {
      return;
    }
    setError(null);
    setNotice(null);

    const entries = sheet.entries.map((entry) => {
      const raw = scores[entry.learnerId]?.score.trim() ?? "";
      return {
        learnerId: entry.learnerId,
        score: raw.length === 0 ? null : Number(raw),
        remark: scores[entry.learnerId]?.remark.trim() || null,
      };
    });

    const parsed = parseResultSubmitInput({
      assessmentId: sheet.assessment.id,
      maxScore: sheet.assessment.maxScore,
      entries,
    });
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setSaving(true);
    const saved = await postJson("/api/staff/results", {
      assessmentId: parsed.value.assessmentId,
      entries: parsed.value.entries,
    });
    setSaving(false);

    if (!saved.ok) {
      setError(saved.message);
      return;
    }
    setNotice("Marks saved.");
    await loadAssessments(classId);
    await openSheet(sheet.assessment.id);
  }

  // --- class summary --------------------------------------------------------

  async function buildReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setReport(null);

    const params = new URLSearchParams({ classId });
    setReportLoading(true);
    const result = await getJson<ClassAcademicReport>(
      `/api/staff/reports/academic?${params.toString()}`,
      "report",
    );
    setReportLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setReport(result.value);
    setReportLearnerId("");
    setReportSubjects(null);
  }

  async function buildLearnerReport(learnerId: string) {
    if (!report) return;
    const learner = report.learners.find((item) => item.learnerId === learnerId);
    if (!learner) return;

    setError(null);
    setReportCardLoading(true);
    setReportLearnerId(learnerId);
    setReportSubjects(null);

    const sheets = await Promise.all(
      report.assessments.map((assessment) =>
        getJson<ResultSheet>(
          `/api/staff/results?assessmentId=${encodeURIComponent(assessment.assessmentId)}`,
          "sheet",
        ),
      ),
    );

    const failed = sheets.find((result) => !result.ok);
    if (failed && !failed.ok) {
      setReportCardLoading(false);
      setError(failed.message);
      return;
    }

    const subjects: TerminalSubject[] = [];
    for (const result of sheets) {
      if (!result.ok) continue;
      const entry = result.value.entries.find(
        (item) => item.learnerId === learnerId,
      );
      if (!entry) continue;
      subjects.push({
        name: result.value.assessment.subjectName
          ? `${result.value.assessment.name} — ${result.value.assessment.subjectName}`
          : result.value.assessment.name,
        grade:
          entry.grade?.label ??
          (entry.percentage === null ? "Not marked" : `${entry.percentage}%`),
        remarks:
          entry.remark ??
          (entry.score === null
            ? "Not marked"
            : `${entry.score}/${result.value.assessment.maxScore}`),
      });
    }

    setReportSubjects(subjects);
    setReportCardLoading(false);
  }

  function downloadResults() {
    if (!classId) return;
    const params = new URLSearchParams({
      kind: "results",
      classId,
      from: exportFrom,
      to: exportTo,
    });
    window.location.assign(`/api/staff/export?${params.toString()}`);
  }

  const subjectSummaries: {
    readonly name: string;
    readonly assessmentCount: number;
    readonly average: number | null;
  }[] = [];
  if (report) {
    const grouped = new Map<string, number[]>();
    for (const assessment of report.assessments) {
      const name = assessment.subjectName ?? "Whole class / mixed";
      const values = grouped.get(name) ?? [];
      if (assessment.averagePercentage !== null) {
        values.push(assessment.averagePercentage);
      }
      grouped.set(name, values);
    }
    for (const [name, values] of grouped) {
      const assessmentCount = report.assessments.filter(
        (assessment) => (assessment.subjectName ?? "Whole class / mixed") === name,
      ).length;
      subjectSummaries.push({
        name,
        assessmentCount,
        average:
          values.length === 0
            ? null
            : Math.round(
                (values.reduce((sum, value) => sum + value, 0) / values.length) *
                  100,
              ) / 100,
      });
    }
  }

  const reportLearner = report?.learners.find(
    (learner) => learner.learnerId === reportLearnerId,
  );

  return (
    <>
      <div className="container stack">
        <PageHeader
          title="Results"
          description="Set an assessment for a class you are assigned to, then record the marks. Grades come from your school&rsquo;s own grading bands, which an administrator configures in Settings."
        />

        {error ? <Alert variant="error">{error}</Alert> : null}
        {notice ? <Alert variant="success">{notice}</Alert> : null}

        <Card>
          <CardHeader
            title="Choose a class"
            description="Only the classes you are assigned to appear here."
          />
          <CardBody>
            <div className="form-grid">
              <SelectField
                label="Class"
                required
                value={classId}
                onChange={(event) => selectClass(event.target.value)}
                options={[
                  { value: "", label: "Choose a class" },
                  ...(classes ?? [])
                    .filter((klass) => klass.isActive)
                    .map((klass) => ({ value: klass.id, label: klass.name })),
                ]}
              />
              <SelectField
                label="Subject"
                value={subjectId}
                onChange={(event) => setSubjectId(event.target.value)}
                options={[
                  { value: "", label: "Whole class" },
                  ...subjects.map((subject) => ({
                    value: subject.id,
                    label: subject.name,
                  })),
                ]}
                hint="Optional. Use it when the work covers one subject."
              />
            </div>
          </CardBody>
        </Card>

        {canManageAssessments && classId ? (
          <Card>
            <CardHeader
              title="Set an assessment"
              description="A name, the maximum score, and the date it was given."
            />
            <CardBody>
              <form className="stack" onSubmit={createAssessmentSheet}>
                <div className="form-grid">
                  <div className="field">
                    <label className="field__label" htmlFor="assessment-name">
                      Name<span className="field__required"> *</span>
                    </label>
                    <input
                      id="assessment-name"
                      className="field__input"
                      type="text"
                      required
                      maxLength={80}
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="assessment-max">
                      Maximum score<span className="field__required"> *</span>
                    </label>
                    <input
                      id="assessment-max"
                      className="field__input"
                      type="number"
                      required
                      min={1}
                      step="any"
                      value={newMax}
                      onChange={(event) => setNewMax(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="assessment-date">
                      Date<span className="field__required"> *</span>
                    </label>
                    <input
                      id="assessment-date"
                      className="field__input"
                      type="date"
                      required
                      max={today}
                      value={newDate}
                      onChange={(event) => setNewDate(event.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" variant="primary">
                  Create assessment
                </Button>
              </form>
            </CardBody>
          </Card>
        ) : null}

        {canReadAssessments && classId ? (
          <Card>
            <CardHeader
              title="Assessments"
              description="Open one to record or correct its marks."
            />
            <CardBody>
              {assessments === null ? (
                <p className="muted">Loading assessments…</p>
              ) : assessments.length === 0 ? (
                <Alert variant="info">
                  No assessments have been set for this class yet.
                </Alert>
              ) : (
                <ul className="record-list">
                  {assessments.map((assessment) => (
                    <li key={assessment.id} className="record">
                      <div className="record__main">
                        <p className="record__title">
                          {assessment.name}
                          {assessment.subjectName
                            ? ` — ${assessment.subjectName}`
                            : ""}
                        </p>
                        <p className="record__meta">
                          {assessment.assessedOn} · out of {assessment.maxScore}{" "}
                          · {assessment.markedCount} of{" "}
                          {assessment.learnerCount} marked
                        </p>
                      </div>
                      <div className="record__actions">
                        {canRecordResults && assessment.isActive ? (
                          <Button
                            size="sm"
                            variant={
                              assessment.markedCount > 0
                                ? "secondary"
                                : "primary"
                            }
                            onClick={() => void openSheet(assessment.id)}
                          >
                            {assessment.markedCount > 0
                              ? "View marks"
                              : "Record marks"}
                          </Button>
                        ) : null}
                        {canManageAssessments && assessment.isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void retireAssessment(assessment.id)}
                          >
                            Retire
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        ) : null}

        {sheet ? (
          <Card>
            <CardHeader
              title={`Marks — ${sheet.assessment.name}`}
              description={`${sheet.assessment.className} · out of ${sheet.assessment.maxScore}${
                sheet.isEditable ? " · changes are recorded in the audit trail" : " · read only"
              }`}
            />
            <CardBody>
              {sheet.entries.length === 0 ? (
                <Alert variant="info">
                  No learners are currently in this class, so there is nothing
                  to mark.
                </Alert>
              ) : (
                <form className="stack" onSubmit={saveSheet}>
                  <TextField
                    label="Search learners"
                    name="roster-search"
                    type="search"
                    placeholder="Name or registration number"
                    value={rosterSearch}
                    onChange={(event) => setRosterSearch(event.target.value)}
                  />
                  <ul className="record-list">
                    {sheet.entries
                      .filter((entry) =>
                        rosterSearch.trim() === "" ||
                        entry.fullName.toLowerCase().includes(rosterSearch.toLowerCase()) ||
                        entry.registrationNumber.toLowerCase().includes(rosterSearch.toLowerCase()),
                      )
                      .map((entry) => (
                      <li key={entry.learnerId} className="record">
                        <div className="record__main">
                          <p className="record__title">{entry.fullName}</p>
                          <p className="record__meta">
                            {entry.registrationNumber}
                            {entry.percentage !== null
                              ? ` · ${entry.percentage}%`
                              : " · not marked"}
                            {entry.percentage !== null
                              ? entry.grade
                                ? ` · ${entry.grade.label}`
                                : " · no grade scale configured"
                              : ""}
                          </p>
                          <div className="form-grid">
                            <div className="field">
                              <label
                                className="field__label"
                                htmlFor={`score-${entry.learnerId}`}
                              >
                                Score
                              </label>
                              <input
                                id={`score-${entry.learnerId}`}
                                className="field__input"
                                type="number"
                                min={0}
                                max={sheet.assessment.maxScore}
                                step="any"
                                disabled={!sheet.isEditable}
                                value={scores[entry.learnerId]?.score ?? ""}
                                onChange={(event) =>
                                  setScore(entry.learnerId, event.target.value)
                                }
                              />
                            </div>
                            <div className="field">
                              <label
                                className="field__label"
                                htmlFor={`remark-${entry.learnerId}`}
                              >
                                Remark
                              </label>
                              <input
                                id={`remark-${entry.learnerId}`}
                                className="field__input"
                                type="text"
                                maxLength={200}
                                disabled={!sheet.isEditable}
                                value={scores[entry.learnerId]?.remark ?? ""}
                                onChange={(event) =>
                                  setRemark(entry.learnerId, event.target.value)
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {sheet.isEditable ? (
                    <div className="form-grid__actions">
                      <Button type="submit" variant="primary" loading={saving}>
                        {saving ? "Saving…" : "Save marks"}
                      </Button>
                    </div>
                  ) : null}
                </form>
              )}
            </CardBody>
          </Card>
        ) : null}

        {canReadReport && classId ? (
          <Card>
            <CardHeader
              title="Class summary"
              description="Averages across the assessments for this class, with subject performance and report cards."
              actions={
                canExportReport ? (
                  <Button size="sm" variant="secondary" onClick={downloadResults}>
                    Download marks CSV
                  </Button>
                ) : null
              }
            />
            <CardBody>
              <form className="stack" onSubmit={buildReport}>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={reportLoading}
                  loading={reportLoading}
                >
                  {reportLoading ? "Building…" : "Build summary"}
                </Button>
              </form>

              {canExportReport ? (
                <form
                  className="inline-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    downloadResults();
                  }}
                >
                  <TextField
                    label="Export from"
                    type="date"
                    value={exportFrom}
                    onChange={(event) => setExportFrom(event.target.value)}
                    required
                  />
                  <TextField
                    label="Export to"
                    type="date"
                    value={exportTo}
                    onChange={(event) => setExportTo(event.target.value)}
                    required
                  />
                  <Button type="submit" variant="secondary">
                    Download CSV
                  </Button>
                </form>
              ) : null}

              {report ? (
                <div className="stack">
                  <p className="muted">
                    {report.className} ·{" "}
                    {report.gradingIsConfigured
                      ? "grades shown against your school’s bands"
                      : "no grading scale configured — percentages only"}
                  </p>

                  {report.assessments.length === 0 ? (
                    <Alert variant="info">
                      No active assessments for this class yet.
                    </Alert>
                  ) : (
                    <ul className="record-list">
                      {report.assessments.map((assessment) => (
                        <li key={assessment.assessmentId} className="record">
                          <div className="record__main">
                            <p className="record__title">{assessment.name}</p>
                            <p className="record__meta">
                              {assessment.assessedOn} · out of{" "}
                              {assessment.maxScore} · {assessment.markedCount}{" "}
                              of {assessment.learnerCount} marked
                            </p>
                          </div>
                          <div className="record__actions">
                            <span className="badge">
                              avg{" "}
                              {assessment.averagePercentage === null
                                ? "—"
                                : `${assessment.averagePercentage}%`}
                            </span>
                            <span className="badge">
                              passed {assessment.passedCount}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {subjectSummaries.length > 0 ? (
                    <div className="stack stack--sm">
                      <p className="muted">Subject performance (mean of assessment averages)</p>
                      <ul className="record-list">
                        {subjectSummaries.map((summary) => (
                          <li key={summary.name} className="record">
                            <div className="record__main">
                              <p className="record__title">{summary.name}</p>
                              <p className="record__meta">
                                {summary.assessmentCount} assessment
                                {summary.assessmentCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <div className="record__actions">
                              <span className="badge">
                                avg {summary.average === null ? "—" : `${summary.average}%`}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {report.learners.length > 0 ? (
                    <ul className="record-list">
                      {report.learners.map((learner) => (
                        <li key={learner.learnerId} className="record">
                          <div className="record__main">
                            <p className="record__title">{learner.fullName}</p>
                            <p className="record__meta">
                              {learner.registrationNumber} ·{" "}
                              {learner.assessmentsTaken} assessment
                              {learner.assessmentsTaken === 1 ? "" : "s"}
                            </p>
                          </div>
                          <div className="record__actions">
                            <span className="badge">
                              avg{" "}
                              {learner.averagePercentage === null
                                ? "—"
                                : `${learner.averagePercentage}%`}
                            </span>
                            {learner.bestGrade ? (
                              <span className="badge badge--active">
                                {learner.bestGrade.label}
                              </span>
                            ) : null}
                            {canReadAssessments ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                loading={reportCardLoading && reportLearnerId === learner.learnerId}
                                onClick={() => void buildLearnerReport(learner.learnerId)}
                              >
                                Report card
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {report && reportLearner && reportSubjects !== null ? (
          <Card>
            <CardHeader
              title={`Custom report card — ${reportLearner.fullName}`}
              description="Built from this learner’s recorded marks across the class’s active assessments."
              actions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => window.print()}>
                    Print report card
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setReportLearnerId("");
                      setReportSubjects(null);
                    }}
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
                className={report.className}
                createdAt={`${today}T00:00:00Z`}
                subjects={reportSubjects}
                teacherRemarks={`Average: ${
                  reportLearner.averagePercentage === null
                    ? "—"
                    : `${reportLearner.averagePercentage}%`
                }. ${reportLearner.assessmentsTaken} assessment(s) recorded.`}
              />
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
