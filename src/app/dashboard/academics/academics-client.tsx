"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextField, SelectField } from "@/components/ui/form";

const NETWORK_MESSAGE = "We could not reach the server. Check your connection and try again.";

interface AcademicYear {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
  readonly status: string;
  readonly terms: readonly TermSummary[];
}

interface TermSummary {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly yearName?: string;
}

interface ExamSchedule {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: string;
}

interface ExamSlot {
  readonly id: string;
  readonly subjectName: string | null;
  readonly className: string | null;
  readonly examDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly roomName: string | null;
}

type PostResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

async function postJson(url: string, body: unknown): Promise<PostResult> {
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
    return { ok: false, message: payload.error ?? "The change could not be saved." };
  }
  return { ok: true };
}

async function getJson<T>(
  url: string,
  pick: (payload: Record<string, unknown>) => T | null,
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const value = pick(payload);
  if (!response.ok || payload["ok"] !== true || value === null) {
    const error = payload["error"];
    return { ok: false, message: typeof error === "string" ? error : "The data could not be loaded." };
  }
  return { ok: true, value };
}

export function AcademicsClient({
  canReadAcademic,
  canManageAcademic,
}: {
  readonly canReadAcademic: boolean;
  readonly canManageAcademic: boolean;
}) {
  const [tab, setTab] = useState<"years" | "exams">("years");

  return (
    <div className="container stack">
      <div className="stack stack--sm">
        <h1>Academics</h1>
        <p className="muted">
          Manage academic years, terms, calendar events, and examination schedules.
        </p>
      </div>

      <div className="cluster" style={{ gap: "0.5rem" }}>
        <button
          type="button"
          className={tab === "years" ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
          onClick={() => setTab("years")}
        >
          Academic Years & Terms
        </button>
        <button
          type="button"
          className={tab === "exams" ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
          onClick={() => setTab("exams")}
        >
          Examinations
        </button>
      </div>

      {tab === "years" ? (
        <AcademicYearsTab canRead={canReadAcademic} canManage={canManageAcademic} />
      ) : (
        <ExaminationsTab canRead={canReadAcademic} canManage={canManageAcademic} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academic Years & Terms Tab
// ---------------------------------------------------------------------------

function AcademicYearsTab({
  canRead,
  canManage,
}: {
  readonly canRead: boolean;
  readonly canManage: boolean;
}) {
  const [years, setYears] = useState<AcademicYear[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    void (async () => {
      const result = await getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null);
      if (cancelled) return;
      if (result.ok) {
        setYears(result.value);
      } else {
        setError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canRead]);

  async function handleCreateYear(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setCreating(true);
    const result = await postJson("/api/staff/academic-years", {
      name: yearName,
      startsOn: yearStart,
      endsOn: yearEnd,
    });
    setCreating(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Academic year created.");
    setYearName("");
    setYearStart("");
    setYearEnd("");
    const refresh = await getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null);
    if (refresh.ok) setYears(refresh.value);
  }

  async function handleActivateYear(yearId: string) {
    if (!canManage) return;
    const result = await postJson("/api/staff/academics/status", {
      entityType: "year",
      id: yearId,
      status: "ACTIVE",
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Academic year activated.");
    const refresh = await getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null);
    if (refresh.ok) setYears(refresh.value);
  }

  async function handleCloseYear(yearId: string) {
    if (!canManage) return;
    const result = await postJson("/api/staff/academics/status", {
      entityType: "year",
      id: yearId,
      status: "CLOSED",
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Academic year closed.");
    const refresh = await getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null);
    if (refresh.ok) setYears(refresh.value);
  }

  if (!canRead) {
    return <Alert variant="warning">You do not have permission to view academic data.</Alert>;
  }

  return (
    <div className="stack">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {canManage ? (
        <Card>
          <CardHeader title="Create academic year" />
          <CardBody>
            <form className="inline-form" onSubmit={handleCreateYear} noValidate>
              <TextField label="Name" value={yearName} onChange={(e) => setYearName(e.target.value)} required />
              <TextField label="Starts" type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} required />
              <TextField label="Ends" type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} required />
              <Button type="submit" loading={creating}>Create</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Academic years" />
        <CardBody>
          {years === null ? (
            <p className="muted" role="status">Loadingâ€¦</p>
          ) : years.length === 0 ? (
            <p className="muted">No academic years yet.</p>
          ) : (
            <ul className="record-list">
              {years.map((y: AcademicYear) => (
                <li className="record" key={y.id}>
                  <div className="record__main">
                    <p className="record__title">{y.name}</p>
                    <p className="record__meta">
                      <span>{y.startsOn} â†’ {y.endsOn}</span>
                      <span>Status: {y.status ?? "UPCOMING"}</span>
                      {y.isCurrent ? <span className="badge badge--accepted">Current</span> : null}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="record__actions">
                      <Button size="sm" variant="secondary" onClick={() => handleActivateYear(y.id)}>Activate</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCloseYear(y.id)}>Close</Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Examinations Tab
// ---------------------------------------------------------------------------

function ExaminationsTab({
  canRead,
  canManage,
}: {
  readonly canRead: boolean;
  readonly canManage: boolean;
}) {
  const [schedules, setSchedules] = useState<ExamSchedule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermSummary[] | null>(null);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [creating, setCreating] = useState(false);

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [slotSubjectId, setSlotSubjectId] = useState("");
  const [slotClassId, setSlotClassId] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotRoom, setSlotRoom] = useState("");
  const [creatingSlot, setCreatingSlot] = useState(false);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    void (async () => {
      const [schedResult, yearsResult, classesResult, subjectsResult] = await Promise.all([
        getJson("/api/staff/exam-schedules", (p) => (p["schedules"] as ExamSchedule[]) ?? null),
        getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null),
        getJson("/api/staff/classes", (p) => (p["classes"] as { id: string; name: string }[]) ?? null),
        getJson("/api/staff/subjects", (p) => (p["subjects"] as { id: string; name: string }[]) ?? null),
      ]);
      if (cancelled) return;
      if (schedResult.ok) setSchedules(schedResult.value);
      else setError(schedResult.message);
      if (yearsResult.ok) {
        const allTerms: TermSummary[] = [];
        for (const y of yearsResult.value) {
          for (const t of y.terms ?? []) {
            allTerms.push({ ...t, yearName: y.name });
          }
        }
        setTerms(allTerms);
      }
      if (classesResult.ok) setClasses(classesResult.value ?? []);
      if (subjectsResult.ok) setSubjects(subjectsResult.value ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [canRead]);

  async function handleCreateSchedule(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selectedTermId) return;
    setError(null);
    setNotice(null);
    setCreating(true);
    const result = await postJson("/api/staff/exam-schedules", {
      termId: selectedTermId,
      name: scheduleName,
      startsOn: scheduleStart,
      endsOn: scheduleEnd,
    });
    setCreating(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Exam schedule created.");
    setScheduleName("");
    setScheduleStart("");
    setScheduleEnd("");
    const refresh = await getJson("/api/staff/exam-schedules", (p) => (p["schedules"] as ExamSchedule[]) ?? null);
    if (refresh.ok) setSchedules(refresh.value);
  }

  async function handlePublish(scheduleId: string) {
    if (!canManage) return;
    const result = await postJson("/api/staff/exam-schedules/update", {
      scheduleId,
      status: "PUBLISHED",
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Exam schedule published.");
    const refresh = await getJson("/api/staff/exam-schedules", (p) => (p["schedules"] as ExamSchedule[]) ?? null);
    if (refresh.ok) setSchedules(refresh.value);
  }

  async function loadSlots(scheduleId: string) {
    const result = await getJson(`/api/staff/exam-timetable-slots?scheduleId=${scheduleId}`, (p) => (p["slots"] as ExamSlot[]) ?? null);
    if (result.ok) setSlots(result.value);
  }

  async function handleCreateSlot(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selectedScheduleId) return;
    setError(null);
    setNotice(null);
    setCreatingSlot(true);
    const result = await postJson("/api/staff/exam-timetable-slots", {
      examScheduleId: selectedScheduleId,
      subjectId: slotSubjectId,
      classId: slotClassId,
      examDate: slotDate,
      startTime: slotStart,
      endTime: slotEnd,
      roomName: slotRoom || null,
      supervisorId: null,
    });
    setCreatingSlot(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Timetable slot created.");
    setSlotSubjectId("");
    setSlotClassId("");
    setSlotDate("");
    setSlotStart("");
    setSlotEnd("");
    setSlotRoom("");
    await loadSlots(selectedScheduleId);
  }

  if (!canRead) {
    return <Alert variant="warning">You do not have permission to view academic data.</Alert>;
  }

  return (
    <div className="stack">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {canManage ? (
        <Card>
          <CardHeader title="Create exam schedule" />
          <CardBody>
            <form className="inline-form" onSubmit={handleCreateSchedule} noValidate>
              <SelectField
                label="Term"
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                options={[
                  { value: "", label: "Choose a term" },
                  ...(terms ?? []).map((t: TermSummary) => ({
                    value: t.id,
                    label: `${t.yearName} â€” ${t.name}`,
                  })),
                ]}
              />
              <TextField label="Name" value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} required />
              <TextField label="Starts" type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} required />
              <TextField label="Ends" type="date" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} required />
              <Button type="submit" loading={creating}>Create</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Exam schedules" />
        <CardBody>
          {schedules === null ? (
            <p className="muted" role="status">Loadingâ€¦</p>
          ) : schedules.length === 0 ? (
            <p className="muted">No exam schedules yet.</p>
          ) : (
            <ul className="record-list">
              {schedules.map((s: ExamSchedule) => (
                <li className="record" key={s.id}>
                  <div className="record__main">
                    <p className="record__title">{s.name}</p>
                    <p className="record__meta">
                      <span>{s.startsOn} â†’ {s.endsOn}</span>
                      <span>Status: {s.status}</span>
                    </p>
                  </div>
                  {canManage ? (
                    <div className="record__actions">
                      <Button size="sm" variant="secondary" onClick={() => handlePublish(s.id)}>
                        Publish
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

        </CardBody>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader title="Exam timetable slots" description="Add individual exam slots to a schedule." />
          <CardBody>
            <form className="inline-form" onSubmit={handleCreateSlot} noValidate>
              <SelectField
                label="Schedule"
                value={selectedScheduleId}
                onChange={(e) => {
                  setSelectedScheduleId(e.target.value);
                  if (e.target.value) loadSlots(e.target.value);
                }}
                options={[
                  { value: "", label: "Choose a schedule" },
                  ...(schedules ?? []).map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <SelectField
                label="Subject"
                value={slotSubjectId}
                onChange={(e) => setSlotSubjectId(e.target.value)}
                options={[
                  { value: "", label: "Choose a subject" },
                  ...subjects.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <SelectField
                label="Class"
                value={slotClassId}
                onChange={(e) => setSlotClassId(e.target.value)}
                options={[
                  { value: "", label: "Choose a class" },
                  ...classes.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <TextField label="Date" type="datetime-local" value={slotDate} onChange={(e) => setSlotDate(e.target.value.slice(0, 10))} required />
              <TextField label="Start time" type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} required />
              <TextField label="End time" type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} required />
              <TextField label="Room" value={slotRoom} onChange={(e) => setSlotRoom(e.target.value)} />
              <Button type="submit" loading={creatingSlot}>Add slot</Button>
            </form>

            {slots.length > 0 ? (
              <ul className="record-list" style={{ marginTop: "1rem" }}>
                {slots.map((slot) => (
                  <li className="record" key={slot.id}>
                    <div className="record__main">
                      <p className="record__title">{slot.subjectName ?? "Subject"} — {slot.className ?? "Class"}</p>
                      <p className="record__meta">
                        <span>{slot.examDate}</span>
                        <span>{slot.startTime} → {slot.endTime}</span>
                        {slot.roomName ? <span>Room: {slot.roomName}</span> : null}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : selectedScheduleId ? (
              <p className="muted" style={{ marginTop: "1rem" }}>No slots yet for this schedule.</p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

