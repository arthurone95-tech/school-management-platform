"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/form";
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUSES,
  parseReportQuery,
  parseSessionCreateInput,
} from "@/lib/attendance/requests";
import { utcToday } from "@/lib/dates";
import type {
  AttendanceClassOption,
  AttendanceClassReport,
  AttendanceSessionDetail,
  AttendanceSessionSummary,
  AttendanceStatus,
  AttendanceSubjectOption,
} from "@/lib/attendance/types";
import { roleLabel } from "@/lib/staff/roles";

/**
 * Attendance (D-030).
 *
 * Two capabilities, shown according to what the gate established:
 *
 *   * **Take attendance** (`attendance.record`). Choose a class, an optional
 *     subject and a date, open a register, then mark every learner. The register
 *     is submitted whole, because a partially submitted register looks the same
 *     as a complete one. A session older than today is read-only for a teacher —
 *     the server enforces that too, and this only avoids offering a control that
 *     would be refused.
 *   * **Class report** (`attendance.report`, administrators only). Status totals
 *     and a per-learner breakdown over a bounded window.
 *
 * The interface reuses the server's own parsers, so it cannot submit something
 * the API would reject. It is still not an authorization boundary: the routes and
 * the `can_access_class` policy decide what is actually allowed
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

type Marks = Record<string, { status: AttendanceStatus; note: string }>;

export function AttendanceClient({
  email,
  role,
  schoolName,
  canTakeAttendance,
  canViewReport,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canTakeAttendance: boolean;
  readonly canViewReport: boolean;
}) {
  const router = useRouter();
  const today = useMemo(() => utcToday(), []);

  const [classes, setClasses] = useState<AttendanceClassOption[]>([]);
  const [subjects, setSubjects] = useState<AttendanceSubjectOption[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [sessionDate, setSessionDate] = useState(today);

  const [sessions, setSessions] = useState<AttendanceSessionSummary[] | null>(
    null,
  );
  const [register, setRegister] = useState<AttendanceSessionDetail | null>(
    null,
  );
  const [marks, setMarks] = useState<Marks>({});
  const [saving, setSaving] = useState(false);

  const [reportFrom, setReportFrom] = useState(today);
  const [reportTo, setReportTo] = useState(today);
  const [report, setReport] = useState<AttendanceClassReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  /** Loads the classes the caller may attend, plus subjects for a chosen class. */
  const loadOptions = useCallback(async (nextClassId: string) => {
    const params = new URLSearchParams();
    if (nextClassId) {
      params.set("classId", nextClassId);
    }
    const query = params.toString();
    const result = await getJson<{
      classes: AttendanceClassOption[];
      subjects: AttendanceSubjectOption[];
    }>(`/api/staff/attendance/options${query ? `?${query}` : ""}`, "classes");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setClasses(result.value.classes);
    setSubjects(result.value.subjects);
  }, []);

  const loadSessions = useCallback(async (date: string) => {
    const result = await getJson<AttendanceSessionSummary[]>(
      `/api/staff/attendance/sessions?date=${encodeURIComponent(date)}`,
      "sessions",
    );
    if (!result.ok) {
      setError(result.message);
      setSessions(null);
      return;
    }
    setError(null);
    setSessions(result.value);
  }, []);

  // Initial load: options and today's registers.
  useEffect(() => {
    void (async () => {
      await loadOptions("");
      if (canTakeAttendance) {
        await loadSessions(sessionDate);
      }
    })();
  }, [canTakeAttendance, loadOptions, loadSessions, sessionDate]);

  function selectClass(nextClassId: string) {
    setClassId(nextClassId);
    setSubjectId("");
    setRegister(null);
    setMarks({});
    setNotice(null);
    void loadOptions(nextClassId);
  }

  function changeDate(nextDate: string) {
    setSessionDate(nextDate);
    setRegister(null);
    setMarks({});
    void loadSessions(nextDate);
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

  // --- open a register -------------------------------------------------------

  async function startRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    // The same parser the route runs, so the message matches and nothing
    // impossible is sent.
    const parsed = parseSessionCreateInput(
      { classId, subjectId, sessionDate },
      today,
    );
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    const created = await postJson("/api/staff/attendance/sessions", {
      classId: parsed.value.classId,
      subjectId: parsed.value.subjectId,
      sessionDate: parsed.value.sessionDate,
    });
    if (!created.ok) {
      setError(created.message);
      return;
    }

    await loadSessions(sessionDate);
    setNotice("Register opened. Mark each learner, then save.");
  }

  async function openRegister(sessionId: string) {
    setError(null);
    setNotice(null);

    const result = await getJson<AttendanceSessionDetail>(
      `/api/staff/attendance/register?sessionId=${encodeURIComponent(sessionId)}`,
      "detail",
    );
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setRegister(result.value);

    // Seed from what is recorded, defaulting unmarked learners to present.
    const seeded: Marks = {};
    for (const learner of result.value.roster) {
      seeded[learner.learnerId] = {
        status: learner.status ?? "present",
        note: learner.note ?? "",
      };
    }
    setMarks(seeded);
  }

  function setStatus(learnerId: string, status: AttendanceStatus) {
    setMarks((current) => ({
      ...current,
      [learnerId]: { status, note: current[learnerId]?.note ?? "" },
    }));
  }

  function setNote(learnerId: string, note: string) {
    setMarks((current) => ({
      ...current,
      [learnerId]: { status: current[learnerId]?.status ?? "present", note },
    }));
  }

  async function saveRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!register) {
      return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);

    const saved = await postJson("/api/staff/attendance/register", {
      sessionId: register.session.id,
      entries: register.roster.map((learner) => ({
        learnerId: learner.learnerId,
        status: marks[learner.learnerId]?.status ?? "present",
        note: marks[learner.learnerId]?.note.trim() || null,
      })),
    });
    setSaving(false);

    if (!saved.ok) {
      setError(saved.message);
      return;
    }

    setNotice("Register saved.");
    await loadSessions(sessionDate);
    await openRegister(register.session.id);
  }

  // --- report ----------------------------------------------------------------

  async function buildReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportError(null);
    setReport(null);

    const parsed = parseReportQuery(
      {
        get: (name) =>
          ({ classId, from: reportFrom, to: reportTo })[name] ?? null,
      },
      today,
    );
    if (!parsed.ok) {
      setReportError(parsed.message);
      return;
    }

    const params = new URLSearchParams({
      classId: parsed.value.classId,
      from: parsed.value.from,
      to: parsed.value.to,
    });

    setReportLoading(true);
    const result = await getJson<AttendanceClassReport>(
      `/api/staff/attendance/report?${params.toString()}`,
      "report",
    );
    setReportLoading(false);

    if (!result.ok) {
      setReportError(result.message);
      return;
    }
    setReport(result.value);
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand">
            <span className="brand__name">{schoolName ?? "Your school"}</span>
            <span className="brand__context">
              {roleLabel(role)}
              {email ? ` · ${email}` : ""}
            </span>
          </div>
          <div className="cluster cluster--end">
            <Link className="btn btn--secondary btn--sm" href="/dashboard">
              Dashboard
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleSignOut()}
              loading={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container stack">
        <div className="stack stack--sm">
          <h1>Attendance</h1>
          <p className="muted">
            Take a register for a class you are assigned to. You can change it
            while the date is still today; ask an administrator for an earlier
            one.
          </p>
        </div>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {notice ? <Alert variant="success">{notice}</Alert> : null}

        {canTakeAttendance ? (
          <>
            <Card>
              <CardHeader
                title="Take attendance"
                description="Choose a class, an optional subject and the date, then mark each learner."
              />
              <CardBody>
                <form className="stack" onSubmit={startRegister}>
                  <div className="form-grid">
                    <SelectField
                      label="Class"
                      required
                      value={classId}
                      onChange={(event) => selectClass(event.target.value)}
                      options={[
                        { value: "", label: "Choose a class" },
                        ...classes.map((klass) => ({
                          value: klass.id,
                          label: klass.isActive
                            ? klass.name
                            : `${klass.name} (inactive)`,
                        })),
                      ]}
                      hint="You only see the classes you are assigned to."
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
                      hint="Optional. Use it when the register is for one subject."
                    />
                    <div className="field">
                      <label className="field__label" htmlFor="attendance-date">
                        Date<span className="field__required"> *</span>
                      </label>
                      <input
                        id="attendance-date"
                        className="field__input"
                        type="date"
                        required
                        max={today}
                        value={sessionDate}
                        onChange={(event) => changeDate(event.target.value)}
                      />
                      <p className="field__hint">
                        Registers for today can still be corrected by a teacher.
                      </p>
                    </div>
                  </div>
                  <Button type="submit" variant="primary" disabled={!classId}>
                    Open register
                  </Button>
                </form>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title={`Registers on ${sessionDate}`}
                description="Open one to mark or correct it."
              />
              <CardBody>
                {sessions === null ? (
                  <p className="muted">Loading registers…</p>
                ) : sessions.length === 0 ? (
                  <Alert variant="info">
                    No registers have been opened for this date yet.
                  </Alert>
                ) : (
                  <ul className="record-list">
                    {sessions.map((session) => (
                      <li key={session.id} className="record">
                        <div className="record__main">
                          <p className="record__title">
                            {session.className}
                            {session.subjectName
                              ? ` — ${session.subjectName}`
                              : ""}
                          </p>
                          <p className="record__meta">
                            {session.recordedCount} of{" "}
                            {register?.session.id === session.id
                              ? register.roster.length
                              : "?"}{" "}
                            learners marked
                            {!session.isCorrectable
                              ? " · closed for teachers"
                              : ""}
                          </p>
                        </div>
                        <div className="record__actions">
                          <Button
                            size="sm"
                            variant={
                              session.recordedCount > 0
                                ? "secondary"
                                : "primary"
                            }
                            onClick={() => void openRegister(session.id)}
                          >
                            {session.recordedCount > 0
                              ? "View register"
                              : "Mark register"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            {register ? (
              <Card>
                <CardHeader
                  title={`Register — ${register.session.className}${
                    register.session.subjectName
                      ? ` (${register.session.subjectName})`
                      : ""
                  }`}
                  description={
                    register.session.isCorrectable
                      ? `${register.session.sessionDate} · change it and save`
                      : `${register.session.sessionDate} · closed for teachers. Ask an administrator to change it.`
                  }
                />
                <CardBody>
                  {register.roster.length === 0 ? (
                    <Alert variant="info">
                      No learners are currently in this class, so there is
                      nothing to mark.
                    </Alert>
                  ) : (
                    <form className="stack" onSubmit={saveRegister}>
                      <ul className="record-list">
                        {register.roster.map((learner) => {
                          const current =
                            marks[learner.learnerId]?.status ?? "present";
                          return (
                            <li key={learner.learnerId} className="record">
                              <div className="record__main">
                                <p className="record__title">
                                  {learner.fullName}
                                </p>
                                <p className="record__meta">
                                  {learner.registrationNumber}
                                </p>
                                <fieldset
                                  className="stack--sm"
                                  style={{ border: 0, margin: 0, padding: 0 }}
                                >
                                  <legend className="visually-hidden">
                                    Attendance for {learner.fullName}
                                  </legend>
                                  <div className="cluster">
                                    {ATTENDANCE_STATUSES.map((status) => {
                                      const inputId = `attendance-${learner.learnerId}-${status}`;
                                      return (
                                        <span key={status} className="cluster">
                                          <input
                                            id={inputId}
                                            type="radio"
                                            name={`attendance-${learner.learnerId}`}
                                            value={status}
                                            checked={current === status}
                                            disabled={
                                              !register.session.isCorrectable
                                            }
                                            onChange={() =>
                                              setStatus(
                                                learner.learnerId,
                                                status,
                                              )
                                            }
                                          />
                                          <label htmlFor={inputId}>
                                            {ATTENDANCE_STATUS_LABELS[status]}
                                          </label>
                                        </span>
                                      );
                                    })}
                                  </div>
                                </fieldset>
                                <div className="field">
                                  <label
                                    className="field__label"
                                    htmlFor={`attendance-note-${learner.learnerId}`}
                                  >
                                    Note
                                  </label>
                                  <input
                                    id={`attendance-note-${learner.learnerId}`}
                                    className="field__input"
                                    type="text"
                                    maxLength={200}
                                    disabled={!register.session.isCorrectable}
                                    value={marks[learner.learnerId]?.note ?? ""}
                                    onChange={(event) =>
                                      setNote(
                                        learner.learnerId,
                                        event.target.value,
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="form-grid__actions">
                        <Button
                          type="submit"
                          variant="primary"
                          loading={saving}
                          disabled={!register.session.isCorrectable}
                        >
                          {register.session.recordedCount > 0
                            ? "Save corrections"
                            : "Save register"}
                        </Button>
                      </div>
                    </form>
                  )}
                </CardBody>
              </Card>
            ) : null}
          </>
        ) : null}

        {canViewReport ? (
          <Card>
            <CardHeader
              title="Class report"
              description="Attendance totals for one class over a date range."
            />
            <CardBody>
              <form className="stack" onSubmit={buildReport}>
                <div className="form-grid">
                  <SelectField
                    label="Class"
                    required
                    value={classId}
                    onChange={(event) => selectClass(event.target.value)}
                    options={[
                      { value: "", label: "Choose a class" },
                      ...classes.map((klass) => ({
                        value: klass.id,
                        label: klass.name,
                      })),
                    ]}
                  />
                  <div className="field">
                    <label className="field__label" htmlFor="report-from">
                      From
                    </label>
                    <input
                      id="report-from"
                      className="field__input"
                      type="date"
                      required
                      max={today}
                      value={reportFrom}
                      onChange={(event) => setReportFrom(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="report-to">
                      To
                    </label>
                    <input
                      id="report-to"
                      className="field__input"
                      type="date"
                      required
                      max={today}
                      value={reportTo}
                      onChange={(event) => setReportTo(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!classId || reportLoading}
                >
                  Build report
                </Button>
              </form>

              {reportError ? (
                <Alert variant="error">{reportError}</Alert>
              ) : null}

              {report ? (
                <div className="stack">
                  <p className="muted">
                    {report.className} · {report.from} to {report.to} ·{" "}
                    {report.sessionCount} register
                    {report.sessionCount === 1 ? "" : "s"}
                  </p>
                  <ul className="record-list">
                    {report.totals.map((total) => (
                      <li key={total.status} className="record">
                        <div className="record__main">
                          <p className="record__title">
                            {ATTENDANCE_STATUS_LABELS[total.status]}
                          </p>
                        </div>
                        <div className="record__actions">
                          <span className="badge badge--active">
                            {total.count}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {report.learners.length === 0 ? (
                    <Alert variant="info">
                      No learners are currently in this class.
                    </Alert>
                  ) : (
                    /* A list rather than a wide table: on a phone the columns
                       would scroll sideways, and each learner is one row of
                       counts either way (docs/UI_UX_DOCUMENTATION.md 11). */
                    <ul className="record-list">
                      {report.learners.map((learner) => (
                        <li key={learner.learnerId} className="record">
                          <div className="record__main">
                            <p className="record__title">{learner.fullName}</p>
                            <p className="record__meta mono">
                              {learner.registrationNumber}
                            </p>
                            <ul className="cluster">
                              {ATTENDANCE_STATUSES.map((status) => (
                                <li key={status} className="badge">
                                  {ATTENDANCE_STATUS_LABELS[status]}:{" "}
                                  {learner[status]}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
