"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField, TextField } from "@/components/ui/form";
import type { AssessmentSummary } from "@/lib/academics/types";
import { utcToday } from "@/lib/dates";

const NETWORK_MESSAGE = "We could not reach the server. Check your connection and try again.";

const EVENT_TYPES = [
  "GENERAL",
  "HOLIDAY",
  "EXAM",
  "MEETING",
  "SPORTS",
  "CULTURAL",
  "OTHER",
] as const;

interface TermSummary {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
  readonly status: string;
  readonly vacationStart: string | null;
  readonly vacationEnd: string | null;
  readonly examStart: string | null;
  readonly examEnd: string | null;
  readonly yearName?: string;
}

interface AcademicYear {
  readonly id: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly isCurrent: boolean;
  readonly status: string;
  readonly isActive: boolean;
  readonly terms: readonly TermSummary[];
}

interface AcademicEvent {
  readonly id: string;
  readonly termId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly eventType: string;
  readonly startsOn: string;
  readonly endsOn: string;
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
  readonly supervisorId: string | null;
}

interface StaffOption {
  readonly membershipId: string;
  readonly role: string;
  readonly status: string;
  readonly assignments: readonly {
    readonly subjectId: string | null;
  }[];
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
  canExportReport,
}: {
  readonly canReadAcademic: boolean;
  readonly canManageAcademic: boolean;
  readonly canExportReport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The tab is held in the URL so the sidebar shortcut can open it directly.
  const tab = searchParams.get("tab") === "exams" ? "exams" : "years";

  function selectTab(next: "years" | "exams") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "exams") {
      params.set("tab", "exams");
    } else {
      params.delete("tab");
    }
    const query = params.toString();
    router.replace(
      query ? `/dashboard/academics?${query}` : "/dashboard/academics",
      { scroll: false },
    );
  }

  return (
    <div className="container stack">
      <div className="stack stack--sm">
        <PageHeader
          title="Academics"
          description="Manage academic years, terms, calendar events, and examination schedules."
        />
      </div>

      <div className="cluster cluster--tight">
        <button
          type="button"
          className={tab === "years" ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
          onClick={() => selectTab("years")}
        >
          Academic Years &amp; Terms
        </button>
        <button
          type="button"
          className={tab === "exams" ? "btn btn--primary btn--sm" : "btn btn--secondary btn--sm"}
          onClick={() => selectTab("exams")}
        >
          Examinations
        </button>
      </div>

      {tab === "years" ? (
        <AcademicYearsTab canRead={canReadAcademic} canManage={canManageAcademic} />
      ) : (
        <ExaminationsTab
          canRead={canReadAcademic}
          canManage={canManageAcademic}
          canExportReport={canExportReport}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Academic Years, Terms and Calendar
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
  const [showHistory, setShowHistory] = useState(false);

  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editYearName, setEditYearName] = useState("");
  const [editYearStart, setEditYearStart] = useState("");
  const [editYearEnd, setEditYearEnd] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [termYearId, setTermYearId] = useState("");
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [termVacationStart, setTermVacationStart] = useState("");
  const [termVacationEnd, setTermVacationEnd] = useState("");
  const [termExamStart, setTermExamStart] = useState("");
  const [termExamEnd, setTermExamEnd] = useState("");
  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editTermName, setEditTermName] = useState("");
  const [editTermStart, setEditTermStart] = useState("");
  const [editTermEnd, setEditTermEnd] = useState("");
  const [editVacationStart, setEditVacationStart] = useState("");
  const [editVacationEnd, setEditVacationEnd] = useState("");
  const [editExamStart, setEditExamStart] = useState("");
  const [editExamEnd, setEditExamEnd] = useState("");

  const [events, setEvents] = useState<AcademicEvent[] | null>(null);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<string>("GENERAL");
  const [eventDescription, setEventDescription] = useState("");
  const [eventTermId, setEventTermId] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [creatingEvent, setCreatingEvent] = useState(false);

  const allTerms: TermSummary[] = (years ?? []).flatMap((year) =>
    year.terms.map((term) => ({ ...term, yearName: year.name })),
  );

  async function refreshYears(): Promise<void> {
    const result = await getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null);
    if (result.ok) {
      setYears(result.value);
    } else {
      setError(result.message);
    }
  }

  async function refreshEvents(): Promise<void> {
    const result = await getJson("/api/staff/academic-events", (p) => (p["events"] as AcademicEvent[]) ?? null);
    if (result.ok) {
      setEvents(result.value);
    } else {
      setError(result.message);
    }
  }

  useEffect(() => {
    if (!canRead) return;
    void (async () => {
      const [yearsResult, eventsResult] = await Promise.all([
        getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null),
        getJson("/api/staff/academic-events", (p) => (p["events"] as AcademicEvent[]) ?? null),
      ]);
      if (yearsResult.ok) {
        setYears(yearsResult.value);
      } else {
        setError(yearsResult.message);
      }
      if (eventsResult.ok) {
        setEvents(eventsResult.value);
      } else {
        setError(eventsResult.message);
      }
    })();
  }, [canRead]);

  function startEditYear(year: AcademicYear) {
    setEditingYearId(year.id);
    setEditYearName(year.name);
    setEditYearStart(year.startsOn);
    setEditYearEnd(year.endsOn);
  }

  function startEditTerm(term: TermSummary) {
    setEditingTermId(term.id);
    setEditTermName(term.name);
    setEditTermStart(term.startsOn);
    setEditTermEnd(term.endsOn);
    setEditVacationStart(term.vacationStart ?? "");
    setEditVacationEnd(term.vacationEnd ?? "");
    setEditExamStart(term.examStart ?? "");
    setEditExamEnd(term.examEnd ?? "");
  }

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
    await refreshYears();
  }

  async function handleSaveYear(yearId: string) {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setBusyId(yearId);
    const result = await postJson("/api/staff/academic-years/update", {
      academicYearId: yearId,
      name: editYearName,
      startsOn: editYearStart,
      endsOn: editYearEnd,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditingYearId(null);
    setNotice("Academic year updated.");
    await refreshYears();
  }

  async function setYearStatus(yearId: string, status: "ACTIVE" | "CLOSED") {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setBusyId(yearId);
    const result = await postJson("/api/staff/academic-years/update", {
      academicYearId: yearId,
      status,
      ...(status === "ACTIVE" ? { isCurrent: true } : {}),
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(status === "ACTIVE" ? "Academic year activated." : "Academic year closed.");
    await refreshYears();
  }

  async function handleCreateTerm(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !termYearId) return;
    setError(null);
    setNotice(null);
    const result = await postJson("/api/staff/terms", {
      academicYearId: termYearId,
      name: termName,
      startsOn: termStart,
      endsOn: termEnd,
      vacationStart: termVacationStart || null,
      vacationEnd: termVacationEnd || null,
      examStart: termExamStart || null,
      examEnd: termExamEnd || null,
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Term created.");
    setTermName("");
    setTermStart("");
    setTermEnd("");
    setTermVacationStart("");
    setTermVacationEnd("");
    setTermExamStart("");
    setTermExamEnd("");
    await refreshYears();
  }

  async function handleSaveTerm(termId: string) {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setBusyId(termId);
    const result = await postJson("/api/staff/terms/update", {
      termId,
      name: editTermName,
      startsOn: editTermStart,
      endsOn: editTermEnd,
      vacationStart: editVacationStart || null,
      vacationEnd: editVacationEnd || null,
      examStart: editExamStart || null,
      examEnd: editExamEnd || null,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setEditingTermId(null);
    setNotice("Term updated.");
    await refreshYears();
  }

  async function setTermStatus(termId: string, status: "ACTIVE" | "CLOSED") {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setBusyId(termId);
    const result = await postJson("/api/staff/academics/status", {
      entityType: "term",
      id: termId,
      status,
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(status === "ACTIVE" ? "Term activated." : "Term closed.");
    await refreshYears();
  }

  async function handleCreateEvent(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setCreatingEvent(true);
    const result = await postJson("/api/staff/academic-events", {
      termId: eventTermId || null,
      title: eventTitle,
      description: eventDescription || null,
      eventType,
      startsOn: eventStart,
      endsOn: eventEnd,
    });
    setCreatingEvent(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Activity added to the academic calendar.");
    setEventTitle("");
    setEventDescription("");
    setEventStart("");
    setEventEnd("");
    await refreshEvents();
  }

  async function handleDeleteEvent(eventId: string) {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setBusyId(eventId);
    const result = await postJson("/api/staff/academic-events/update", {
      eventId,
      action: "delete",
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Activity removed from the calendar.");
    await refreshEvents();
  }

  if (!canRead) {
    return <Alert variant="warning">You do not have permission to view academic data.</Alert>;
  }

  const visibleYears = showHistory ? years : (years ?? []).filter((year) => year.status !== "CLOSED");

  return (
    <div className="stack">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {canManage ? (
        <Card>
          <CardHeader title="Create academic year" description="Set the opening and closing dates for the year." />
          <CardBody>
            <form className="inline-form" onSubmit={handleCreateYear} noValidate>
              <TextField label="Name" value={yearName} onChange={(e) => setYearName(e.target.value)} required />
              <TextField label="Opens" type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} required />
              <TextField label="Closes" type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} required />
              <Button type="submit" loading={creating}>Create</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Academic years and terms"
          description="Activate the current year and term, record vacation and exam windows, and close completed periods."
          actions={
            <label className="cluster">
              <input
                type="checkbox"
                checked={showHistory}
                onChange={(event) => setShowHistory(event.target.checked)}
              />
              Show history
            </label>
          }
        />
        <CardBody>
          {years === null ? (
            <p className="muted" role="status">Loading…</p>
          ) : (visibleYears ?? []).length === 0 ? (
            <EmptyState
              title={showHistory ? "No archived periods" : "No academic years yet"}
              description={showHistory ? "Closed years will appear here." : "Create a year to begin the academic calendar."}
            />
          ) : (
            <ul className="record-list">
              {(visibleYears ?? []).map((year) => (
                <li className="record" key={year.id}>
                  <div className="record__main">
                    {editingYearId === year.id ? (
                      <form
                        className="inline-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleSaveYear(year.id);
                        }}
                        noValidate
                      >
                        <TextField label="Name" value={editYearName} onChange={(e) => setEditYearName(e.target.value)} required />
                        <TextField label="Opens" type="date" value={editYearStart} onChange={(e) => setEditYearStart(e.target.value)} required />
                        <TextField label="Closes" type="date" value={editYearEnd} onChange={(e) => setEditYearEnd(e.target.value)} required />
                        <Button type="submit" size="sm" loading={busyId === year.id}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingYearId(null)}>Cancel</Button>
                      </form>
                    ) : (
                      <>
                        <p className="record__title">{year.name}</p>
                        <p className="record__meta">
                          <span>{year.startsOn} → {year.endsOn}</span>
                          <span>Status: {year.status ?? "UPCOMING"}</span>
                          {year.isCurrent ? <span className="badge badge--accepted">Current</span> : null}
                          {year.status === "CLOSED" ? <span className="badge">History</span> : null}
                        </p>
                      </>
                    )}
                    <ul className="record-list list--spaced">
                      {year.terms.map((term) => (
                        <li className="record" key={term.id}>
                          <div className="record__main">
                            {editingTermId === term.id ? (
                              <form
                                className="inline-form"
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  void handleSaveTerm(term.id);
                                }}
                                noValidate
                              >
                                <TextField label="Name" value={editTermName} onChange={(e) => setEditTermName(e.target.value)} required />
                                <TextField label="Opens" type="date" value={editTermStart} onChange={(e) => setEditTermStart(e.target.value)} required />
                                <TextField label="Closes" type="date" value={editTermEnd} onChange={(e) => setEditTermEnd(e.target.value)} required />
                                <TextField label="Vacation from" type="date" value={editVacationStart} onChange={(e) => setEditVacationStart(e.target.value)} />
                                <TextField label="Vacation to" type="date" value={editVacationEnd} onChange={(e) => setEditVacationEnd(e.target.value)} />
                                <TextField label="Exams from" type="date" value={editExamStart} onChange={(e) => setEditExamStart(e.target.value)} />
                                <TextField label="Exams to" type="date" value={editExamEnd} onChange={(e) => setEditExamEnd(e.target.value)} />
                                <Button type="submit" size="sm" loading={busyId === term.id}>Save</Button>
                                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingTermId(null)}>Cancel</Button>
                              </form>
                            ) : (
                              <>
                                <p className="record__title">{term.name}</p>
                                <p className="record__meta">
                                  <span>{term.startsOn} → {term.endsOn}</span>
                                  <span>Status: {term.status}</span>
                                  {term.vacationStart && term.vacationEnd ? (
                                    <span>Vacation: {term.vacationStart} → {term.vacationEnd}</span>
                                  ) : null}
                                  {term.examStart && term.examEnd ? (
                                    <span>Exams: {term.examStart} → {term.examEnd}</span>
                                  ) : null}
                                  {term.isCurrent ? <span className="badge badge--accepted">Current</span> : null}
                                  {term.status === "CLOSED" ? <span className="badge">History</span> : null}
                                </p>
                              </>
                            )}
                          </div>
                          {canManage && editingTermId !== term.id ? (
                            <div className="record__actions">
                              <Button size="sm" variant="secondary" loading={busyId === term.id} onClick={() => startEditTerm(term)}>Edit</Button>
                              <Button size="sm" variant="secondary" loading={busyId === term.id} onClick={() => void setTermStatus(term.id, "ACTIVE")}>Activate</Button>
                              <Button size="sm" variant="ghost" loading={busyId === term.id} onClick={() => void setTermStatus(term.id, "CLOSED")}>Close</Button>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {canManage && editingYearId !== year.id ? (
                    <div className="record__actions">
                      <Button size="sm" variant="secondary" onClick={() => startEditYear(year)}>Edit</Button>
                      <Button size="sm" variant="secondary" loading={busyId === year.id} onClick={() => void setYearStatus(year.id, "ACTIVE")}>Activate</Button>
                      <Button size="sm" variant="ghost" loading={busyId === year.id} onClick={() => void setYearStatus(year.id, "CLOSED")}>Close</Button>
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
          <CardHeader title="Create a term" description="Add opening, closing, vacation and examination dates." />
          <CardBody>
            <form className="inline-form" onSubmit={handleCreateTerm} noValidate>
              <SelectField
                label="Academic year"
                required
                value={termYearId}
                onChange={(e) => setTermYearId(e.target.value)}
                options={[
                  { value: "", label: "Choose a year" },
                  ...(years ?? []).filter((year) => year.status !== "CLOSED").map((year) => ({ value: year.id, label: year.name })),
                ]}
              />
              <TextField label="Name" value={termName} onChange={(e) => setTermName(e.target.value)} required />
              <TextField label="Opens" type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} required />
              <TextField label="Closes" type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} required />
              <TextField label="Vacation from" type="date" value={termVacationStart} onChange={(e) => setTermVacationStart(e.target.value)} />
              <TextField label="Vacation to" type="date" value={termVacationEnd} onChange={(e) => setTermVacationEnd(e.target.value)} />
              <TextField label="Exams from" type="date" value={termExamStart} onChange={(e) => setTermExamStart(e.target.value)} />
              <TextField label="Exams to" type="date" value={termExamEnd} onChange={(e) => setTermExamEnd(e.target.value)} />
              <Button type="submit" disabled={!termYearId}>Create</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Academic calendar" description="Scheduled school activities, holidays and examination periods." />
        <CardBody className="stack stack--sm">
          {canManage ? (
            <form className="inline-form" onSubmit={handleCreateEvent} noValidate>
              <TextField label="Activity" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
              <SelectField
                label="Type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                options={EVENT_TYPES.map((type) => ({ value: type, label: type }))}
              />
              <SelectField
                label="Term"
                value={eventTermId}
                onChange={(e) => setEventTermId(e.target.value)}
                options={[
                  { value: "", label: "Whole year" },
                  ...allTerms.map((term) => ({ value: term.id, label: `${term.yearName ?? ""} — ${term.name}` })),
                ]}
              />
              <TextField label="From" type="date" value={eventStart} onChange={(e) => setEventStart(e.target.value)} required />
              <TextField label="To" type="date" value={eventEnd} onChange={(e) => setEventEnd(e.target.value)} required />
              <TextField label="Details" value={eventDescription} onChange={(e) => setEventDescription(e.target.value)} />
              <Button type="submit" loading={creatingEvent}>Add activity</Button>
            </form>
          ) : null}

          {events === null ? (
            <p className="muted" role="status">Loading activities…</p>
          ) : events.length === 0 ? (
            <EmptyState title="No activities scheduled" description="Add a date to the academic calendar when one is confirmed." />
          ) : (
            <ul className="record-list">
              {events.map((event) => (
                <li className="record" key={event.id}>
                  <div className="record__main">
                    <p className="record__title">{event.title}</p>
                    <p className="record__meta">
                      <span>{event.eventType}</span>
                      <span>{event.startsOn} → {event.endsOn}</span>
                      {event.description ? <span>{event.description}</span> : null}
                    </p>
                  </div>
                  {canManage ? (
                    <div className="record__actions">
                      <Button size="sm" variant="ghost" loading={busyId === event.id} onClick={() => void handleDeleteEvent(event.id)}>Remove</Button>
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
// Examinations
// ---------------------------------------------------------------------------

function ExaminationsTab({
  canRead,
  canManage,
  canExportReport,
}: {
  readonly canRead: boolean;
  readonly canManage: boolean;
  readonly canExportReport: boolean;
}) {
  const [schedules, setSchedules] = useState<ExamSchedule[] | null>(null);
  const [terms, setTerms] = useState<TermSummary[]>([]);
  const [selectedTermId, setSelectedTermId] = useState("");
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [creating, setCreating] = useState(false);

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [slots, setSlots] = useState<ExamSlot[] | null>(null);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [slotSubjectId, setSlotSubjectId] = useState("");
  const [slotClassId, setSlotClassId] = useState("");
  const [slotSupervisorId, setSlotSupervisorId] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotStart, setSlotStart] = useState("");
  const [slotEnd, setSlotEnd] = useState("");
  const [slotRoom, setSlotRoom] = useState("");
  const [creatingSlot, setCreatingSlot] = useState(false);
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  const [assessments, setAssessments] = useState<AssessmentSummary[] | null>(null);
  const [examReportClassId, setExamReportClassId] = useState("");
  const [examReportFrom, setExamReportFrom] = useState(() =>
    new Date(Date.parse(`${utcToday()}T00:00:00Z`) - 90 * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
  const [examReportTo, setExamReportTo] = useState(() => utcToday());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshSchedules(): Promise<void> {
    const result = await getJson("/api/staff/exam-schedules", (p) => (p["schedules"] as ExamSchedule[]) ?? null);
    if (result.ok) {
      setSchedules(result.value);
    } else {
      setError(result.message);
    }
  }

  async function loadSlots(scheduleId: string) {
    const result = await getJson(`/api/staff/exam-timetable-slots?scheduleId=${encodeURIComponent(scheduleId)}`, (p) => (p["slots"] as ExamSlot[]) ?? null);
    if (result.ok) {
      setSlots(result.value);
    } else {
      setError(result.message);
      setSlots(null);
    }
  }

  function downloadExamReport() {
    if (!examReportClassId) return;
    const params = new URLSearchParams({
      kind: "results",
      classId: examReportClassId,
      from: examReportFrom,
      to: examReportTo,
    });
    window.location.assign(`/api/staff/export?${params.toString()}`);
  }

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    void (async () => {
      const [schedResult, yearsResult, classesResult, subjectsResult, staffResult, assessmentsResult] = await Promise.all([
        getJson("/api/staff/exam-schedules", (p) => (p["schedules"] as ExamSchedule[]) ?? null),
        getJson("/api/staff/academic-years", (p) => (p["academicYears"] as AcademicYear[]) ?? null),
        getJson("/api/staff/classes", (p) => (p["classes"] as { id: string; name: string }[]) ?? null),
        getJson("/api/staff/subjects", (p) => (p["subjects"] as { id: string; name: string }[]) ?? null),
        getJson("/api/staff/members", (p) => (p["members"] as StaffOption[]) ?? null),
        getJson("/api/staff/assessments", (p) => (p["assessments"] as AssessmentSummary[]) ?? null),
      ]);
      if (cancelled) return;
      if (schedResult.ok) setSchedules(schedResult.value);
      else setError(schedResult.message);
      if (yearsResult.ok) {
        const allTerms: TermSummary[] = [];
        for (const year of yearsResult.value) {
          for (const term of year.terms ?? []) {
            allTerms.push({ ...term, yearName: year.name });
          }
        }
        setTerms(allTerms);
      }
      if (classesResult.ok) setClasses(classesResult.value ?? []);
      if (subjectsResult.ok) setSubjects(subjectsResult.value ?? []);
      if (staffResult.ok) setStaff(staffResult.value ?? []);
      else setStaffError(staffResult.message);
      if (assessmentsResult.ok) setAssessments(assessmentsResult.value);
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
    await refreshSchedules();
  }

  async function handlePublish(scheduleId: string) {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    const result = await postJson("/api/staff/exam-schedules/update", {
      scheduleId,
      status: "PUBLISHED",
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Exam timetable published.");
    await refreshSchedules();
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
      supervisorId: slotSupervisorId || null,
    });
    setCreatingSlot(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Timetable slot created. You can now assign or change its supervisor.");
    setSlotSubjectId("");
    setSlotClassId("");
    setSlotSupervisorId("");
    setSlotDate("");
    setSlotStart("");
    setSlotEnd("");
    setSlotRoom("");
    await loadSlots(selectedScheduleId);
  }

  async function handleAssignSupervisor(slot: ExamSlot, supervisorId: string) {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setBusySlotId(slot.id);
    const result = await postJson("/api/staff/exam-timetable-slots/update", {
      slotId: slot.id,
      supervisorId: supervisorId || null,
    });
    setBusySlotId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(supervisorId ? "Supervisor assigned." : "Supervisor removed.");
    await loadSlots(selectedScheduleId);
  }

  async function handleDeleteSlot(slotId: string) {
    if (!canManage) return;
    setError(null);
    setNotice(null);
    setBusySlotId(slotId);
    const result = await postJson("/api/staff/exam-timetable-slots/update", {
      slotId,
      action: "delete",
    });
    setBusySlotId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice("Timetable slot removed.");
    await loadSlots(selectedScheduleId);
  }

  if (!canRead) {
    return <Alert variant="warning">You do not have permission to view academic data.</Alert>;
  }

  const activeSlots = slots ?? [];
  const assignedSlots = activeSlots.filter((slot) => slot.supervisorId !== null).length;
  const rooms = new Set(activeSlots.map((slot) => slot.roomName).filter((room): room is string => room !== null)).size;

  return (
    <div className="stack">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {canManage ? (
        <Card>
          <CardHeader title="Create exam schedule" description="Choose the term and the examination window." />
          <CardBody>
            <form className="inline-form" onSubmit={handleCreateSchedule} noValidate>
              <SelectField
                label="Term"
                required
                value={selectedTermId}
                onChange={(e) => setSelectedTermId(e.target.value)}
                options={[
                  { value: "", label: "Choose a term" },
                  ...terms.map((term) => ({ value: term.id, label: `${term.yearName ?? ""} — ${term.name}` })),
                ]}
              />
              <TextField label="Name" value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} required />
              <TextField label="From" type="date" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} required />
              <TextField label="To" type="date" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} required />
              <Button type="submit" loading={creating} disabled={!selectedTermId}>Create</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Exam schedules and preparation"
          description="Select a schedule to see its timetable, supervisor coverage and room bookings."
          actions={
            selectedScheduleId ? (
              <Button size="sm" variant="secondary" onClick={() => window.print()}>Print timetable</Button>
            ) : null
          }
        />
        <CardBody className="stack stack--sm">
          {schedules === null ? (
            <p className="muted" role="status">Loading schedules…</p>
          ) : schedules.length === 0 ? (
            <EmptyState title="No exam schedules yet" description="Create a schedule, then add its timetable slots." />
          ) : (
            <ul className="record-list">
              {schedules.map((schedule) => (
                <li className="record" key={schedule.id}>
                  <div className="record__main">
                    <p className="record__title">{schedule.name}</p>
                    <p className="record__meta">
                      <span>{schedule.startsOn} → {schedule.endsOn}</span>
                      <span>Status: {schedule.status}</span>
                    </p>
                  </div>
                  <div className="record__actions">
                    <Button
                      size="sm"
                      variant={selectedScheduleId === schedule.id ? "primary" : "secondary"}
                      onClick={() => {
                        setSelectedScheduleId(schedule.id);
                        void loadSlots(schedule.id);
                      }}
                    >
                      View timetable
                    </Button>
                    {canManage && schedule.status !== "PUBLISHED" ? (
                      <Button size="sm" variant="ghost" onClick={() => void handlePublish(schedule.id)}>Publish</Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedScheduleId ? (
            <div className="stack stack--sm">
              <p className="muted">
                Preparation: {activeSlots.length} slot{activeSlots.length === 1 ? "" : "s"} · {assignedSlots} with supervisors · {rooms} room{rooms === 1 ? "" : "s"} booked.
              </p>
              {slots === null ? (
                <p className="muted" role="status">Loading timetable…</p>
              ) : slots.length === 0 ? (
                <EmptyState title="No slots yet" description="Add the subjects, classes, dates and rooms for this examination." />
              ) : (
                <ul className="record-list">
                  {slots.map((slot) => (
                    <li className="record" key={slot.id}>
                      <div className="record__main">
                        <p className="record__title">{slot.subjectName ?? "Subject"} — {slot.className ?? "Class"}</p>
                        <p className="record__meta">
                          <span>{slot.examDate}</span>
                          <span>{slot.startTime} → {slot.endTime}</span>
                          {slot.roomName ? <span>Room: {slot.roomName}</span> : <span>Room not set</span>}
                        </p>
                      </div>
                      <div className="record__actions">
                        <SelectField
                          label="Supervisor"
                          value={slot.supervisorId ?? ""}
                          disabled={!canManage || busySlotId === slot.id}
                          onChange={(event) => void handleAssignSupervisor(slot, event.target.value)}
                          options={[
                            { value: "", label: "No supervisor" },
                            ...staff
                              .filter((member) => member.status === "active")
                              .map((member) => ({ value: member.membershipId, label: member.role })),
                          ]}
                          hint={staffError ?? "Supervisors come from the school's staff list."}
                        />
                        {canManage ? (
                          <Button size="sm" variant="ghost" loading={busySlotId === slot.id} onClick={() => void handleDeleteSlot(slot.id)}>Remove</Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader title="Exam timetable slots" description="Add individual examinations to a published or draft schedule." />
          <CardBody>
            <form className="inline-form" onSubmit={handleCreateSlot} noValidate>
              <SelectField
                label="Schedule"
                required
                value={selectedScheduleId}
                onChange={(e) => {
                  setSelectedScheduleId(e.target.value);
                  if (e.target.value) void loadSlots(e.target.value);
                }}
                options={[
                  { value: "", label: "Choose a schedule" },
                  ...(schedules ?? []).map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <SelectField
                label="Subject"
                required
                value={slotSubjectId}
                onChange={(e) => setSlotSubjectId(e.target.value)}
                options={[
                  { value: "", label: "Choose a subject" },
                  ...subjects.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
              <SelectField
                label="Class"
                required
                value={slotClassId}
                onChange={(e) => setSlotClassId(e.target.value)}
                options={[
                  { value: "", label: "Choose a class" },
                  ...classes.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <SelectField
                label="Supervisor"
                value={slotSupervisorId}
                onChange={(e) => setSlotSupervisorId(e.target.value)}
                options={[
                  { value: "", label: "Assign later" },
                  ...staff
                    .filter((member) => member.status === "active")
                    .map((member) => ({ value: member.membershipId, label: member.role })),
                ]}
              />
              <TextField label="Date" type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} required />
              <TextField label="Start time" type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} required />
              <TextField label="End time" type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} required />
              <TextField label="Room" value={slotRoom} onChange={(e) => setSlotRoom(e.target.value)} />
              <Button type="submit" loading={creatingSlot} disabled={!selectedScheduleId}>Add slot</Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Marks submission and completion"
          description="Progress across recorded assessments. Published result approval remains a separate, unbuilt workflow."
          actions={
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              Print marks summary
            </Button>
          }
        />
        <CardBody className="stack stack--sm">
          {canExportReport ? (
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                downloadExamReport();
              }}
            >
              <SelectField
                label="Report class"
                required
                value={examReportClassId}
                onChange={(e) => setExamReportClassId(e.target.value)}
                options={[
                  { value: "", label: "Choose a class" },
                  ...classes.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <TextField
                label="From"
                type="date"
                required
                value={examReportFrom}
                onChange={(e) => setExamReportFrom(e.target.value)}
              />
              <TextField
                label="To"
                type="date"
                required
                value={examReportTo}
                onChange={(e) => setExamReportTo(e.target.value)}
              />
              <Button type="submit" variant="secondary" disabled={!examReportClassId}>
                Download examination report
              </Button>
            </form>
          ) : null}

          {assessments === null ? (
            <p className="muted" role="status">Loading assessment progress…</p>
          ) : assessments.length === 0 ? (
            <EmptyState title="No assessments recorded" description="Marks progress appears once an assessment is set." />
          ) : (
            <ul className="record-list">
              {assessments.map((assessment) => (
                <li className="record" key={assessment.id}>
                  <div className="record__main">
                    <p className="record__title">{assessment.name}</p>
                    <p className="record__meta">
                      <span>{assessment.className}</span>
                      {assessment.subjectName ? <span>{assessment.subjectName}</span> : null}
                      <span>{assessment.assessedOn}</span>
                    </p>
                  </div>
                  <div className="record__actions">
                    <span className="badge">
                      {assessment.markedCount} of {assessment.learnerCount} marked
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
