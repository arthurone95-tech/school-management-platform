"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import {
  parseAcademicYearCreateInput,
  parseAcademicYearUpdateInput,
  parseSchoolProfileUpdateInput,
  parseTermCreateInput,
  parseTermUpdateInput,
} from "@/lib/administration/requests";
import type {
  AcademicYearSummary,
  SchoolProfile,
} from "@/lib/administration/types";
import { AssessmentModeToggle } from "./assessment-mode-toggle";

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

type PostResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

/** Posts JSON and normalises the API's `{ ok, error }` envelope. */
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
    return {
      ok: false,
      message: payload.error ?? "The change could not be saved.",
    };
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

export function SchoolClient({
  canManageSchool,
  canReadAcademic,
  canManageAcademic,
  canManageSubjects,
  canManageGrading,
}: {
  readonly canManageSchool: boolean;
  readonly canReadAcademic: boolean;
  readonly canManageAcademic: boolean;
  readonly canManageSubjects: boolean;
  readonly canManageGrading: boolean;
}) {
  const router = useRouter();

  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  const [years, setYears] = useState<AcademicYearSummary[] | null>(null);
  const [academicError, setAcademicError] = useState<string | null>(null);
  const [academicNotice, setAcademicNotice] = useState<string | null>(null);
  const [academicKey, setAcademicKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [yearName, setYearName] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [creatingYear, setCreatingYear] = useState(false);

  const [editingYearId, setEditingYearId] = useState<string | null>(null);
  const [editYearName, setEditYearName] = useState("");
  const [editYearStart, setEditYearStart] = useState("");
  const [editYearEnd, setEditYearEnd] = useState("");

  const [addingTermYearId, setAddingTermYearId] = useState<string | null>(null);
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");

  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editTermName, setEditTermName] = useState("");
  const [editTermStart, setEditTermStart] = useState("");
  const [editTermEnd, setEditTermEnd] = useState("");

  useEffect(() => {
    if (!canManageSchool) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getJson(
        "/api/staff/school",
        (payload) => (payload["school"] as SchoolProfile | undefined) ?? null,
      );
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setProfile(result.value);
        setNameDraft(result.value.name);
      } else {
        setProfileError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageSchool]);

  useEffect(() => {
    if (!canReadAcademic) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getJson(
        "/api/staff/academic-years",
        (payload) =>
          (payload["academicYears"] as AcademicYearSummary[] | undefined) ??
          null,
      );
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setYears(result.value);
        setAcademicError(null);
      } else {
        setAcademicError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadAcademic, academicKey]);

  function reloadAcademic() {
    setYears(null);
    setAcademicKey((key) => key + 1);
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileNotice(null);

    const parsed = parseSchoolProfileUpdateInput({ name: nameDraft });
    if (!parsed.ok) {
      setProfileError(parsed.message);
      return;
    }

    setSavingProfile(true);
    const result = await postJson("/api/staff/school/update", parsed.value);
    setSavingProfile(false);
    if (!result.ok) {
      setProfileError(result.message);
      return;
    }
    setProfileNotice("School name saved.");
    router.refresh();
  }

  async function handleCreateYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAcademicError(null);
    setAcademicNotice(null);

    const parsed = parseAcademicYearCreateInput({
      name: yearName,
      startsOn: yearStart,
      endsOn: yearEnd,
    });
    if (!parsed.ok) {
      setAcademicError(parsed.message);
      return;
    }

    setCreatingYear(true);
    const result = await postJson("/api/staff/academic-years", parsed.value);
    setCreatingYear(false);
    if (!result.ok) {
      setAcademicError(result.message);
      return;
    }
    setYearName("");
    setYearStart("");
    setYearEnd("");
    setAcademicNotice(`Added ${parsed.value.name}.`);
    reloadAcademic();
  }

  async function handleSetCurrent(year: AcademicYearSummary) {
    setAcademicError(null);
    setAcademicNotice(null);
    setBusyId(year.id);
    const result = await postJson("/api/staff/academic-years/update", {
      academicYearId: year.id,
      isCurrent: true,
    });
    setBusyId(null);
    if (!result.ok) {
      setAcademicError(result.message);
      return;
    }
    setAcademicNotice(`${year.name} is now the current year.`);
    reloadAcademic();
  }

  async function handleSaveYear(year: AcademicYearSummary) {
    setAcademicError(null);
    setAcademicNotice(null);

    const parsed = parseAcademicYearUpdateInput({
      academicYearId: year.id,
      name: editYearName,
      startsOn: editYearStart,
      endsOn: editYearEnd,
    });
    if (!parsed.ok) {
      setAcademicError(parsed.message);
      return;
    }

    setBusyId(year.id);
    const result = await postJson(
      "/api/staff/academic-years/update",
      parsed.value,
    );
    setBusyId(null);
    if (!result.ok) {
      setAcademicError(result.message);
      return;
    }
    setEditingYearId(null);
    setAcademicNotice(`Saved ${parsed.value.name ?? year.name}.`);
    reloadAcademic();
  }

  async function handleCreateTerm(
    event: FormEvent<HTMLFormElement>,
    year: AcademicYearSummary,
  ) {
    event.preventDefault();
    setAcademicError(null);
    setAcademicNotice(null);

    const parsed = parseTermCreateInput({
      academicYearId: year.id,
      name: termName,
      startsOn: termStart,
      endsOn: termEnd,
    });
    if (!parsed.ok) {
      setAcademicError(parsed.message);
      return;
    }

    setBusyId(year.id);
    const result = await postJson("/api/staff/terms", parsed.value);
    setBusyId(null);
    if (!result.ok) {
      setAcademicError(result.message);
      return;
    }
    setTermName("");
    setTermStart("");
    setTermEnd("");
    setAddingTermYearId(null);
    setAcademicNotice(`Added ${parsed.value.name} to ${year.name}.`);
    reloadAcademic();
  }

  async function handleSaveTerm(
    event: FormEvent<HTMLFormElement>,
    termId: string,
  ) {
    event.preventDefault();
    setAcademicError(null);
    setAcademicNotice(null);

    const parsed = parseTermUpdateInput({
      termId,
      name: editTermName,
      startsOn: editTermStart,
      endsOn: editTermEnd,
    });
    if (!parsed.ok) {
      setAcademicError(parsed.message);
      return;
    }

    setBusyId(termId);
    const result = await postJson("/api/staff/terms/update", parsed.value);
    setBusyId(null);
    if (!result.ok) {
      setAcademicError(result.message);
      return;
    }
    setEditingTermId(null);
    setAcademicNotice("Term saved.");
    reloadAcademic();
  }

  return (
    <>
      <div className="container stack">
        <div className="stack stack--sm">
          <h1>School settings</h1>
          <p className="muted">
            Your school profile, the academic calendar and the assessment
            framework it uses. These belong only to your school.
          </p>
        </div>

        {/* School profile */}
        {canManageSchool ? (
          <Card>
            <CardHeader
              title="School profile"
              description="The school name is shown to your staff and students. The school code is fixed because students use it to sign in."
            />
            <CardBody className="stack stack--sm">
              {profileNotice ? (
                <Alert variant="success">{profileNotice}</Alert>
              ) : null}
              {profileError ? (
                <Alert variant="error">{profileError}</Alert>
              ) : null}
              {profile === null && profileError === null ? (
                <p className="muted" role="status">
                  Loading school profile…
                </p>
              ) : (
                <form
                  className="inline-form"
                  onSubmit={handleSaveProfile}
                  noValidate
                >
                  <TextField
                    label="School name"
                    name="schoolName"
                    autoComplete="off"
                    required
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                  />
                  <Button type="submit" loading={savingProfile}>
                    {savingProfile ? "Saving…" : "Save name"}
                  </Button>
                </form>
              )}
              {profile !== null ? (
                <p className="record__meta">
                  School code: <strong>{profile.code}</strong>
                </p>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {/* Academic years and terms */}
        {canReadAcademic ? (
          <Card>
            <CardHeader
              title="Academic years and terms"
              description="School-defined labels and dates. At most one year is current at a time."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={reloadAcademic}
                  loading={years === null && academicError === null}
                >
                  Refresh
                </Button>
              }
            />
            <CardBody className="stack stack--sm">
              {academicNotice ? (
                <Alert variant="success">{academicNotice}</Alert>
              ) : null}
              {academicError ? (
                <Alert variant="error">{academicError}</Alert>
              ) : null}

              {canManageAcademic ? (
                <form
                  className="inline-form"
                  onSubmit={handleCreateYear}
                  noValidate
                >
                  <TextField
                    label="Year name"
                    name="yearName"
                    autoComplete="off"
                    placeholder="2026/2027"
                    required
                    value={yearName}
                    onChange={(event) => setYearName(event.target.value)}
                  />
                  <TextField
                    label="Starts on"
                    name="yearStart"
                    type="date"
                    required
                    value={yearStart}
                    onChange={(event) => setYearStart(event.target.value)}
                  />
                  <TextField
                    label="Ends on"
                    name="yearEnd"
                    type="date"
                    required
                    value={yearEnd}
                    onChange={(event) => setYearEnd(event.target.value)}
                  />
                  <Button type="submit" loading={creatingYear}>
                    {creatingYear ? "Adding…" : "Add year"}
                  </Button>
                </form>
              ) : (
                <Alert variant="info">
                  Your role cannot change the academic calendar.
                </Alert>
              )}

              {years === null ? (
                academicError === null ? (
                  <p className="muted" role="status">
                    Loading academic years…
                  </p>
                ) : null
              ) : years.length === 0 ? (
                <p className="muted">
                  No academic years yet. Add one to start building the calendar.
                </p>
              ) : (
                <ul className="record-list">
                  {years.map((year) => (
                    <li className="record" key={year.id}>
                      <div className="record__main">
                        {editingYearId === year.id ? (
                          <form
                            className="stack stack--sm"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleSaveYear(year);
                            }}
                            noValidate
                          >
                            <TextField
                              label="Year name"
                              name={`year-name-${year.id}`}
                              autoComplete="off"
                              value={editYearName}
                              onChange={(event) =>
                                setEditYearName(event.target.value)
                              }
                            />
                            <TextField
                              label="Starts on"
                              name={`year-start-${year.id}`}
                              type="date"
                              value={editYearStart}
                              onChange={(event) =>
                                setEditYearStart(event.target.value)
                              }
                            />
                            <TextField
                              label="Ends on"
                              name={`year-end-${year.id}`}
                              type="date"
                              value={editYearEnd}
                              onChange={(event) =>
                                setEditYearEnd(event.target.value)
                              }
                            />
                            <div className="cluster">
                              <Button
                                type="submit"
                                size="sm"
                                loading={busyId === year.id}
                              >
                                Save year
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingYearId(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <p className="record__title">
                              {year.name}
                              {year.isCurrent ? (
                                <span className="badge badge--active">
                                  Current
                                </span>
                              ) : null}
                            </p>
                            <p className="record__meta">
                              {year.startsOn} to {year.endsOn}
                            </p>
                          </>
                        )}

                        {/* Terms */}
                        <div className="stack stack--sm">
                          {year.terms.length === 0 ? (
                            <p className="muted">No terms yet.</p>
                          ) : (
                            <ul className="record-list">
                              {year.terms.map((term) => (
                                <li className="record" key={term.id}>
                                  <div className="record__main">
                                    {editingTermId === term.id ? (
                                      <form
                                        className="stack stack--sm"
                                        onSubmit={(event) =>
                                          void handleSaveTerm(event, term.id)
                                        }
                                        noValidate
                                      >
                                        <TextField
                                          label="Term name"
                                          name={`term-name-${term.id}`}
                                          autoComplete="off"
                                          value={editTermName}
                                          onChange={(event) =>
                                            setEditTermName(event.target.value)
                                          }
                                        />
                                        <TextField
                                          label="Starts on"
                                          name={`term-start-${term.id}`}
                                          type="date"
                                          value={editTermStart}
                                          onChange={(event) =>
                                            setEditTermStart(event.target.value)
                                          }
                                        />
                                        <TextField
                                          label="Ends on"
                                          name={`term-end-${term.id}`}
                                          type="date"
                                          value={editTermEnd}
                                          onChange={(event) =>
                                            setEditTermEnd(event.target.value)
                                          }
                                        />
                                        <div className="cluster">
                                          <Button
                                            type="submit"
                                            size="sm"
                                            loading={busyId === term.id}
                                          >
                                            Save term
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              setEditingTermId(null)
                                            }
                                          >
                                            Cancel
                                          </Button>
                                        </div>
                                      </form>
                                    ) : (
                                      <>
                                        <p className="record__title">
                                          {term.name}
                                        </p>
                                        <p className="record__meta">
                                          {term.startsOn} to {term.endsOn}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                  {canManageAcademic &&
                                  editingTermId !== term.id ? (
                                    <div className="record__actions">
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                          setEditingTermId(term.id);
                                          setEditTermName(term.name);
                                          setEditTermStart(term.startsOn);
                                          setEditTermEnd(term.endsOn);
                                        }}
                                      >
                                        Edit
                                      </Button>
                                    </div>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}

                          {canManageAcademic ? (
                            addingTermYearId === year.id ? (
                              <form
                                className="inline-form"
                                onSubmit={(event) =>
                                  void handleCreateTerm(event, year)
                                }
                                noValidate
                              >
                                <TextField
                                  label="Term name"
                                  name={`new-term-name-${year.id}`}
                                  autoComplete="off"
                                  placeholder="Term 1"
                                  required
                                  value={termName}
                                  onChange={(event) =>
                                    setTermName(event.target.value)
                                  }
                                />
                                <TextField
                                  label="Starts on"
                                  name={`new-term-start-${year.id}`}
                                  type="date"
                                  required
                                  value={termStart}
                                  onChange={(event) =>
                                    setTermStart(event.target.value)
                                  }
                                />
                                <TextField
                                  label="Ends on"
                                  name={`new-term-end-${year.id}`}
                                  type="date"
                                  required
                                  value={termEnd}
                                  onChange={(event) =>
                                    setTermEnd(event.target.value)
                                  }
                                />
                                <Button
                                  type="submit"
                                  size="sm"
                                  loading={busyId === year.id}
                                >
                                  Add term
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setAddingTermYearId(null)}
                                >
                                  Cancel
                                </Button>
                              </form>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setAddingTermYearId(year.id);
                                  setTermName("");
                                  setTermStart("");
                                  setTermEnd("");
                                }}
                              >
                                Add term
                              </Button>
                            )
                          ) : null}
                        </div>
                      </div>

                      {canManageAcademic && editingYearId !== year.id ? (
                        <div className="record__actions">
                          {!year.isCurrent ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={busyId === year.id}
                              onClick={() => void handleSetCurrent(year)}
                            >
                              Set as current
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingYearId(year.id);
                              setEditYearName(year.name);
                              setEditYearStart(year.startsOn);
                              setEditYearEnd(year.endsOn);
                              setAddingTermYearId(null);
                            }}
                          >
                            Edit
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

        <AssessmentModeToggle
          canManage={canManageSchool}
          canConfigure={canManageSubjects || canManageGrading}
        />
      </div>
    </>
  );
}
