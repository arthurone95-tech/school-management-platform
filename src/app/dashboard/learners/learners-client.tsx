"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import {
  GENDERS,
  parseEnrolmentInput,
  type Gender,
} from "@/lib/enrolment/requests";
import type { ClassSummary, LearnerSummary } from "@/lib/enrolment/types";
import { roleLabel } from "@/lib/staff/roles";

type ClassesState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly classes: ClassSummary[] }
  | { readonly kind: "error"; readonly message: string };

type ListState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly learners: LearnerSummary[];
      readonly page: number;
      readonly pageSize: number;
      readonly total: number;
    }
  | { readonly kind: "error"; readonly message: string };

interface EnrolSuccess {
  readonly name: string;
  readonly username: string;
  readonly className: string;
  readonly completedExisting: boolean;
}

const GENDER_OPTIONS = [
  { value: "", label: "Select…" },
  ...GENDERS.map((gender) => ({
    value: gender,
    label: gender.charAt(0).toUpperCase() + gender.slice(1),
  })),
];

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  registrationNumber: "",
  gender: "" as Gender | "",
  dateOfBirth: "",
  residentialAddress: "",
  guardianPhone: "",
  guardianEmail: "",
  classId: "",
};

const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

async function fetchClasses(): Promise<ClassesState> {
  let response: Response;
  try {
    response = await fetch("/api/staff/classes", {
      headers: { Accept: "application/json" },
    });
  } catch {
    return { kind: "error", message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
    readonly classes?: ClassSummary[];
  };
  if (!response.ok || payload.ok !== true || !payload.classes) {
    return {
      kind: "error",
      message: payload.error ?? "The classes could not be loaded.",
    };
  }
  return { kind: "ready", classes: payload.classes };
}

async function fetchLearners(page: number): Promise<ListState> {
  let response: Response;
  try {
    response = await fetch(`/api/staff/learners?page=${page}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return { kind: "error", message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
    readonly learners?: LearnerSummary[];
    readonly page?: number;
    readonly pageSize?: number;
    readonly total?: number;
  };
  if (
    !response.ok ||
    payload.ok !== true ||
    !payload.learners ||
    typeof payload.page !== "number" ||
    typeof payload.pageSize !== "number" ||
    typeof payload.total !== "number"
  ) {
    return {
      kind: "error",
      message: payload.error ?? "The students could not be loaded.",
    };
  }
  return {
    kind: "ready",
    learners: payload.learners,
    page: payload.page,
    pageSize: payload.pageSize,
    total: payload.total,
  };
}

function fullName(learner: LearnerSummary): string {
  return `${learner.firstName} ${learner.lastName}`.trim();
}

export function LearnersClient({
  email,
  role,
  schoolName,
  canRead,
  canEnrol,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canRead: boolean;
  readonly canEnrol: boolean;
}) {
  const router = useRouter();

  const [classesState, setClassesState] = useState<ClassesState>({
    kind: "loading",
  });
  const [listState, setListState] = useState<ListState>({ kind: "loading" });
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<EnrolSuccess | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!canEnrol) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchClasses();
      if (!cancelled) {
        setClassesState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEnrol, reloadKey]);

  useEffect(() => {
    if (!canRead) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchLearners(page);
      if (!cancelled) {
        setListState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canRead, page, reloadKey]);

  function reloadList() {
    setListState({ kind: "loading" });
    setReloadKey((key) => key + 1);
  }

  function goToPage(next: number) {
    setListState({ kind: "loading" });
    setPage(next);
  }

  function update<K extends keyof typeof EMPTY_FORM>(
    key: K,
    value: (typeof EMPTY_FORM)[K],
  ) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);

    const parsed = parseEnrolmentInput(form);
    if (!parsed.ok) {
      setFormError(parsed.message);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/staff/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
        readonly learner?: LearnerSummary;
        readonly completedExisting?: boolean;
      };

      if (!response.ok || payload.ok !== true || !payload.learner) {
        setFormError(payload.error ?? "The student could not be registered.");
        return;
      }

      setSuccess({
        name: fullName(payload.learner),
        username: payload.learner.username,
        className: payload.learner.className ?? "the class",
        completedExisting: payload.completedExisting === true,
      });
      setForm({ ...EMPTY_FORM, classId: form.classId });
      setListState({ kind: "loading" });
      setPage(1);
      setReloadKey((key) => key + 1);
    } catch {
      setFormError(NETWORK_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/staff/sign-out", { method: "POST" });
    } catch {
      // Signing out is best-effort; the redirect below still applies.
    }
    router.replace("/sign-in");
    router.refresh();
  }

  const classes =
    classesState.kind === "ready"
      ? classesState.classes
      : ([] as ClassSummary[]);
  const classOptions = [
    { value: "", label: "Select a class…" },
    ...classes.map((klass) => ({ value: klass.id, label: klass.name })),
  ];
  const noClasses = classesState.kind === "ready" && classes.length === 0;

  const totalPages =
    listState.kind === "ready"
      ? Math.max(1, Math.ceil(listState.total / listState.pageSize))
      : 1;

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
              onClick={handleSignOut}
              loading={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container stack">
        <div className="stack stack--sm">
          <h1>Students</h1>
          <p className="muted">
            Register a student and place them in a class. Registration numbers
            are unique within your school.
          </p>
        </div>

        {!canEnrol ? (
          <Alert variant="info">
            Your role cannot enrol students yet. Only a school administrator can
            register a student.
          </Alert>
        ) : (
          <Card>
            <CardHeader
              title="Enrol a student"
              description="All fields are required unless marked optional. A username is generated automatically."
            />
            <CardBody className="stack stack--sm">
              {success ? (
                <Alert variant="success">
                  {success.completedExisting ? (
                    <>
                      Completed the enrolment for{" "}
                      <strong>{success.name}</strong>, placing them in{" "}
                      {success.className}. Username:{" "}
                      <strong>{success.username}</strong>.
                    </>
                  ) : (
                    <>
                      <strong>{success.name}</strong> is enrolled in{" "}
                      {success.className}. Username:{" "}
                      <strong>{success.username}</strong>.
                    </>
                  )}
                </Alert>
              ) : null}
              {formError ? <Alert variant="error">{formError}</Alert> : null}
              {classesState.kind === "error" ? (
                <Alert variant="error">{classesState.message}</Alert>
              ) : null}
              {noClasses ? (
                <Alert variant="info">
                  Your school has no active classes yet, so a student cannot be
                  placed. A class must be created before enrolment.
                </Alert>
              ) : null}

              <form className="form-grid" onSubmit={handleSubmit} noValidate>
                <TextField
                  label="First name"
                  name="firstName"
                  autoComplete="off"
                  required
                  value={form.firstName}
                  onChange={(event) => update("firstName", event.target.value)}
                />
                <TextField
                  label="Last name"
                  name="lastName"
                  autoComplete="off"
                  required
                  value={form.lastName}
                  onChange={(event) => update("lastName", event.target.value)}
                />
                <TextField
                  label="Registration number"
                  name="registrationNumber"
                  autoComplete="off"
                  required
                  hint="Unique within your school, for example ALPHA-002."
                  value={form.registrationNumber}
                  onChange={(event) =>
                    update("registrationNumber", event.target.value)
                  }
                />
                <SelectField
                  label="Gender"
                  name="gender"
                  required
                  options={GENDER_OPTIONS}
                  value={form.gender}
                  onChange={(event) =>
                    update("gender", event.target.value as Gender | "")
                  }
                />
                <TextField
                  label="Date of birth"
                  name="dateOfBirth"
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={(event) =>
                    update("dateOfBirth", event.target.value)
                  }
                />
                <SelectField
                  label="Class"
                  name="classId"
                  required
                  options={classOptions}
                  value={form.classId}
                  disabled={classesState.kind !== "ready" || noClasses}
                  onChange={(event) => update("classId", event.target.value)}
                />
                <TextField
                  label="Residential address"
                  name="residentialAddress"
                  autoComplete="off"
                  required
                  value={form.residentialAddress}
                  onChange={(event) =>
                    update("residentialAddress", event.target.value)
                  }
                />
                <TextField
                  label="Guardian phone"
                  name="guardianPhone"
                  type="tel"
                  autoComplete="off"
                  required
                  value={form.guardianPhone}
                  onChange={(event) =>
                    update("guardianPhone", event.target.value)
                  }
                />
                <TextField
                  label="Guardian email (optional)"
                  name="guardianEmail"
                  type="email"
                  autoComplete="off"
                  value={form.guardianEmail}
                  onChange={(event) =>
                    update("guardianEmail", event.target.value)
                  }
                />
                <div className="form-grid__actions">
                  <Button
                    type="submit"
                    loading={submitting}
                    disabled={classesState.kind !== "ready" || noClasses}
                  >
                    {submitting ? "Registering…" : "Register student"}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {!canRead ? (
          <Alert variant="info">
            Your role cannot view the student list yet.
          </Alert>
        ) : (
          <Card>
            <CardHeader
              title="Students"
              description={
                listState.kind === "ready" && listState.total > 0
                  ? `${listState.total} student${listState.total === 1 ? "" : "s"} in your school.`
                  : "The students registered in your school."
              }
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={reloadList}
                  loading={listState.kind === "loading"}
                >
                  Refresh
                </Button>
              }
            />
            {listState.kind === "error" ? (
              <CardBody>
                <Alert variant="error">{listState.message}</Alert>
              </CardBody>
            ) : listState.kind === "loading" ? (
              <CardBody>
                <p className="muted" role="status">
                  Loading students…
                </p>
              </CardBody>
            ) : listState.learners.length === 0 ? (
              <CardBody>
                <p className="muted">
                  No students yet. Register the first one above.
                </p>
              </CardBody>
            ) : (
              <>
                <ul className="record-list">
                  {listState.learners.map((learner) => (
                    <li className="record" key={learner.id}>
                      <div className="record__main">
                        <p className="record__title">{fullName(learner)}</p>
                        <p className="record__meta">
                          <span className={`badge badge--${learner.status}`}>
                            {learner.status === "active"
                              ? "Enrolled"
                              : "Inactive"}
                          </span>
                          <span>{learner.className ?? "No class yet"}</span>
                          <span>{learner.registrationNumber}</span>
                          <span className="mono">{learner.username}</span>
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                {totalPages > 1 ? (
                  <div className="card__footer cluster cluster--end">
                    <span className="muted">
                      Page {listState.page} of {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => goToPage(Math.max(1, listState.page - 1))}
                      disabled={listState.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        goToPage(Math.min(totalPages, listState.page + 1))
                      }
                      disabled={listState.page >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
