"use client";

import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

interface AcademicEvent {
  readonly id: string;
  readonly termId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly eventType: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

interface TermOption {
  readonly id: string;
  readonly name: string;
  readonly yearName?: string;
}

interface AcademicYearRow {
  readonly name: string;
  readonly terms: readonly TermOption[] | null;
}

const EVENT_TYPES = [
  "GENERAL",
  "HOLIDAY",
  "EXAM",
  "MEETING",
  "SPORTS",
  "CULTURAL",
  "OTHER",
] as const;

const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  GENERAL: "General",
  HOLIDAY: "Holiday",
  EXAM: "Examination",
  MEETING: "Meeting",
  SPORTS: "Sports",
  CULTURAL: "Cultural",
  OTHER: "Other",
};

const EVENT_TYPE_VARIANTS: Readonly<Record<string, BadgeVariant>> = {
  GENERAL: "neutral",
  HOLIDAY: "info",
  EXAM: "warning",
  MEETING: "info",
  SPORTS: "success",
  CULTURAL: "success",
  OTHER: "neutral",
};

interface EventFormState {
  readonly eventId: string;
  readonly title: string;
  readonly description: string;
  readonly eventType: string;
  readonly termId: string;
  readonly startsOn: string;
  readonly endsOn: string;
}

const EMPTY_FORM: EventFormState = {
  eventId: "",
  title: "",
  description: "",
  eventType: "GENERAL",
  termId: "",
  startsOn: "",
  endsOn: "",
};

type Result<T> = { readonly ok: true; readonly value: T } | {
  readonly ok: false;
  readonly message: string;
};

async function getJson<T>(
  url: string,
  pick: (payload: Record<string, unknown>) => T | null,
): Promise<Result<T>> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const value = pick(payload);
  if (!response.ok || payload["ok"] !== true || value === null) {
    const error = payload["error"];
    return {
      ok: false,
      message:
        typeof error === "string" ? error : "The data could not be loaded.",
    };
  }
  return { ok: true, value };
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }> {
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
      message: payload.error ?? "The change could not be saved.",
    };
  }
  return { ok: true };
}

/**
 * School events screen (Other System Features → F).
 *
 * The table and the two API routes already exist; this screen only supplies the
 * missing interface. Both routes run on the caller's session and are gated by
 * `academic.read` / `academic.manage`, so the page passes the same flags the
 * gate checked and never widens access.
 */
export function EventsClient({
  canReadAcademic,
  canManageAcademic,
}: {
  readonly canReadAcademic: boolean;
  readonly canManageAcademic: boolean;
}) {
  const [events, setEvents] = useState<AcademicEvent[] | null>(null);
  const [terms, setTerms] = useState<readonly TermOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refreshEvents() {
    const result = await getJson<AcademicEvent[]>(
      "/api/staff/academic-events",
      (payload) => (payload["events"] as AcademicEvent[]) ?? null,
    );
    if (result.ok) {
      setEvents(result.value);
    } else {
      setError(result.message);
    }
  }

  useEffect(() => {
    if (!canReadAcademic) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const [eventResult, yearResult] = await Promise.all([
        getJson<AcademicEvent[]>(
          "/api/staff/academic-events",
          (payload) => (payload["events"] as AcademicEvent[]) ?? null,
        ),
        getJson<AcademicYearRow[]>(
          "/api/staff/academic-years",
          (payload) => (payload["academicYears"] as AcademicYearRow[]) ?? null,
        ),
      ]);
      if (cancelled) {
        return;
      }
      if (eventResult.ok) {
        setEvents(eventResult.value);
      } else {
        setError(eventResult.message);
      }
      if (yearResult.ok) {
        setTerms(
          yearResult.value.flatMap((year) =>
            (year.terms ?? []).map((term) => ({
              ...term,
              yearName: term.yearName ?? year.name,
            })),
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadAcademic]);

  function updateForm<K extends keyof EventFormState>(
    key: K,
    value: EventFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManageAcademic) {
      return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);

    const editing = form.eventId !== "";
    const result = await postJson(
      editing
        ? "/api/staff/academic-events/update"
        : "/api/staff/academic-events",
      {
        ...(editing ? { eventId: form.eventId } : {}),
        title: form.title,
        description: form.description,
        eventType: form.eventType,
        // An empty select means "not tied to a term"; the API rejects "".
        termId: form.termId === "" ? null : form.termId,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
      },
    );
    setSaving(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(editing ? "Event updated." : "Event created.");
    resetForm();
    await refreshEvents();
  }

  function handleEdit(item: AcademicEvent) {
    setError(null);
    setNotice(null);
    setForm({
      eventId: item.id,
      title: item.title,
      description: item.description ?? "",
      eventType: item.eventType,
      termId: item.termId ?? "",
      startsOn: item.startsOn,
      endsOn: item.endsOn,
    });
  }

  async function handleDelete(item: AcademicEvent) {
    if (!canManageAcademic) {
      return;
    }
    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
      return;
    }
    setError(null);
    setNotice(null);
    setBusyId(item.id);
    const result = await postJson("/api/staff/academic-events/update", {
      eventId: item.id,
      action: "delete",
    });
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (form.eventId === item.id) {
      resetForm();
    }
    setNotice("Event deleted.");
    await refreshEvents();
  }

  const termLabel = (termId: string | null) => {
    if (termId === null) {
      return "Whole school";
    }
    const term = terms.find((option) => option.id === termId);
    return term
      ? `${term.name}${term.yearName ? ` · ${term.yearName}` : ""}`
      : "Term";
  };

  return (
    <div className="container stack">
      <PageHeader
        title="Events and calendar"
        description="School events, holidays and important dates for your academic year."
      />

      {!canReadAcademic ? (
        <Alert variant="warning">
          You do not have permission to view academic data.
        </Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {canManageAcademic ? (
        <Card>
          <CardHeader
            title={form.eventId === "" ? "Add an event" : "Edit event"}
            description="Dates are inclusive. Leave the term unset for a whole-school event."
          />
          <CardBody>
            <form className="inline-form" onSubmit={handleSubmit} noValidate>
              <TextField
                label="Title"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                maxLength={120}
                required
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                maxLength={500}
              />
              <SelectField
                label="Type"
                value={form.eventType}
                onChange={(e) => updateForm("eventType", e.target.value)}
                options={EVENT_TYPES.map((type) => ({
                  value: type,
                  label: EVENT_TYPE_LABELS[type] ?? type,
                }))}
              />
              <SelectField
                label="Term"
                value={form.termId}
                onChange={(e) => updateForm("termId", e.target.value)}
                options={[
                  { value: "", label: "Whole school" },
                  ...terms.map((term) => ({
                    value: term.id,
                    label: `${term.name}${term.yearName ? ` · ${term.yearName}` : ""}`,
                  })),
                ]}
              />
              <TextField
                label="Starts"
                type="date"
                value={form.startsOn}
                onChange={(e) => updateForm("startsOn", e.target.value)}
                required
              />
              <TextField
                label="Ends"
                type="date"
                value={form.endsOn}
                onChange={(e) => updateForm("endsOn", e.target.value)}
                required
              />
              <Button type="submit" loading={saving}>
                {form.eventId === "" ? "Add event" : "Save changes"}
              </Button>
              {form.eventId !== "" ? (
                <Button variant="ghost" onClick={resetForm}>
                  Cancel edit
                </Button>
              ) : null}
            </form>
          </CardBody>
        </Card>
      ) : null}

      {canReadAcademic ? (
        <Card>
          <CardHeader title="School events" />
          <CardBody>
            {events === null ? (
              <p className="muted" role="status">
                Loading…
              </p>
            ) : events.length === 0 ? (
              <p className="muted">No events have been added yet.</p>
            ) : (
              <ul className="record-list">
                {events.map((item) => (
                  <li className="record" key={item.id}>
                    <div className="record__main">
                      <p className="record__title">{item.title}</p>
                      <p className="record__meta">
                        <Badge
                          variant={EVENT_TYPE_VARIANTS[item.eventType] ?? "neutral"}
                        >
                          {EVENT_TYPE_LABELS[item.eventType] ?? item.eventType}
                        </Badge>
                        <span>{termLabel(item.termId)}</span>
                        <span>
                          {item.startsOn}
                          {item.endsOn !== item.startsOn
                            ? ` → ${item.endsOn}`
                            : ""}
                        </span>
                      </p>
                      {item.description ? (
                        <p className="muted">{item.description}</p>
                      ) : null}
                    </div>
                    {canManageAcademic ? (
                      <div className="record__actions">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busyId === item.id}
                          onClick={() => void handleDelete(item)}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
