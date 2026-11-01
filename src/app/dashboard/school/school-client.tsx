"use client";

import Link from "next/link";
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
  parseSubjectCreateInput,
  parseSubjectUpdateInput,
  parseTermCreateInput,
  parseTermUpdateInput,
} from "@/lib/administration/requests";
import type {
  AcademicYearSummary,
  SchoolProfile,
  SubjectSummary,
} from "@/lib/administration/types";
import { parseGradeBandCreateInput } from "@/lib/academics/requests";
import type { GradeBandSummary } from "@/lib/academics/types";
import { roleLabel } from "@/lib/staff/roles";

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
  email,
  role,
  schoolName,
  canManageSchool,
  canReadAcademic,
  canManageAcademic,
  canReadSubjects,
  canManageSubjects,
  canViewClasses,
  canViewStudents,
  canViewStaff,
  canReadGrading,
  canManageGrading,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canManageSchool: boolean;
  readonly canReadAcademic: boolean;
  readonly canManageAcademic: boolean;
  readonly canReadSubjects: boolean;
  readonly canManageSubjects: boolean;
  readonly canViewClasses: boolean;
  readonly canViewStudents: boolean;
  readonly canViewStaff: boolean;
  readonly canReadGrading: boolean;
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

  const [subjects, setSubjects] = useState<SubjectSummary[] | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [subjectNotice, setSubjectNotice] = useState<string | null>(null);
  const [subjectKey, setSubjectKey] = useState(0);
  const [subjectName, setSubjectName] = useState("");
  const [subjectCode, setSubjectCode] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editSubjectCode, setEditSubjectCode] = useState("");

  const [bands, setBands] = useState<GradeBandSummary[] | null>(null);
  const [bandError, setBandError] = useState<string | null>(null);
  const [bandNotice, setBandNotice] = useState<string | null>(null);
  const [bandMin, setBandMin] = useState("");
  const [bandLabel, setBandLabel] = useState("");
  const [bandRemark, setBandRemark] = useState("");
  const [bandPassing, setBandPassing] = useState(true);
  const [creatingBand, setCreatingBand] = useState(false);
  const [busyBandId, setBusyBandId] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

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

  useEffect(() => {
    if (!canReadSubjects) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getJson(
        "/api/staff/subjects",
        (payload) =>
          (payload["subjects"] as SubjectSummary[] | undefined) ?? null,
      );
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setSubjects(result.value);
        setSubjectError(null);
      } else {
        setSubjectError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadSubjects, subjectKey]);

  useEffect(() => {
    if (!canReadGrading) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getJson(
        "/api/staff/grade-bands",
        (payload) =>
          (payload["bands"] as GradeBandSummary[] | undefined) ?? null,
      );
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setBands(result.value);
        setBandError(null);
      } else {
        setBandError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadGrading, subjectKey]);

  async function handleCreateBand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBandError(null);
    setBandNotice(null);

    const parsed = parseGradeBandCreateInput({
      minPercentage: Number(bandMin),
      label: bandLabel,
      remark: bandRemark,
      isPassing: bandPassing,
    });
    if (!parsed.ok) {
      setBandError(parsed.message);
      return;
    }

    setCreatingBand(true);
    const created = await postJson("/api/staff/grade-bands", parsed.value);
    setCreatingBand(false);

    if (!created.ok) {
      setBandError(created.message);
      return;
    }
    setBandMin("");
    setBandLabel("");
    setBandRemark("");
    setBandNotice("Grade band added.");
    setBands(null);
    setSubjectKey((key) => key + 1);
  }

  async function handleToggleBandPassing(band: GradeBandSummary) {
    setBandError(null);
    setBandNotice(null);
    setBusyBandId(band.id);
    const done = await postJson("/api/staff/grade-bands/update", {
      bandId: band.id,
      isPassing: !band.isPassing,
    });
    setBusyBandId(null);
    if (!done.ok) {
      setBandError(done.message);
      return;
    }
    setBands(null);
    setSubjectKey((key) => key + 1);
  }

  async function handleDeleteBand(band: GradeBandSummary) {
    setBandError(null);
    setBandNotice(null);
    setBusyBandId(band.id);
    const done = await postJson("/api/staff/grade-bands/update", {
      bandId: band.id,
      action: "delete",
    });
    setBusyBandId(null);
    if (!done.ok) {
      setBandError(done.message);
      return;
    }
    setBandNotice(
      "Grade band removed. Marks already recorded keep their score and percentage.",
    );
    setBands(null);
    setSubjectKey((key) => key + 1);
  }

  function reloadAcademic() {
    setYears(null);
    setAcademicKey((key) => key + 1);
  }
  function reloadSubjects() {
    setSubjects(null);
    setSubjectKey((key) => key + 1);
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

  async function handleCreateSubject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubjectError(null);
    setSubjectNotice(null);

    const parsed = parseSubjectCreateInput({
      name: subjectName,
      code: subjectCode,
    });
    if (!parsed.ok) {
      setSubjectError(parsed.message);
      return;
    }

    setCreatingSubject(true);
    const result = await postJson("/api/staff/subjects", parsed.value);
    setCreatingSubject(false);
    if (!result.ok) {
      setSubjectError(result.message);
      return;
    }
    setSubjectName("");
    setSubjectCode("");
    setSubjectNotice(`Added ${parsed.value.name}.`);
    reloadSubjects();
  }

  async function sendSubjectUpdate(body: {
    readonly subjectId: string;
    readonly name?: string;
    readonly code?: string | null;
    readonly isActive?: boolean;
  }): Promise<boolean> {
    setSubjectError(null);
    setSubjectNotice(null);

    const parsed = parseSubjectUpdateInput(body);
    if (!parsed.ok) {
      setSubjectError(parsed.message);
      return false;
    }

    setBusyId(parsed.value.subjectId);
    const result = await postJson("/api/staff/subjects/update", parsed.value);
    setBusyId(null);
    if (!result.ok) {
      setSubjectError(result.message);
      return false;
    }
    return true;
  }

  async function handleToggleSubject(subject: SubjectSummary) {
    const next = !subject.isActive;
    if (await sendSubjectUpdate({ subjectId: subject.id, isActive: next })) {
      setSubjectNotice(
        next ? `Reactivated ${subject.name}.` : `Deactivated ${subject.name}.`,
      );
      reloadSubjects();
    }
  }

  async function handleSaveSubject(subject: SubjectSummary) {
    if (
      await sendSubjectUpdate({
        subjectId: subject.id,
        name: editSubjectName,
        code: editSubjectCode,
      })
    ) {
      setEditingSubjectId(null);
      setSubjectNotice(`Saved ${editSubjectName}.`);
      reloadSubjects();
    }
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

  return (
    <>
      <div className="container stack">
        <div className="stack stack--sm">
          <h1>School settings</h1>
          <p className="muted">
            Your school profile, the academic calendar and the subjects it
            teaches. These belong only to your school.
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

        {/* Subjects */}
        {canReadSubjects ? (
          <Card>
            <CardHeader
              title="Subjects"
              description="Subjects taught by your school. Deactivating a subject removes it from new assignments but keeps past records interpretable."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={reloadSubjects}
                  loading={subjects === null && subjectError === null}
                >
                  Refresh
                </Button>
              }
            />
            <CardBody className="stack stack--sm">
              {subjectNotice ? (
                <Alert variant="success">{subjectNotice}</Alert>
              ) : null}
              {subjectError ? (
                <Alert variant="error">{subjectError}</Alert>
              ) : null}

              {canManageSubjects ? (
                <form
                  className="inline-form"
                  onSubmit={handleCreateSubject}
                  noValidate
                >
                  <TextField
                    label="Subject name"
                    name="subjectName"
                    autoComplete="off"
                    required
                    value={subjectName}
                    onChange={(event) => setSubjectName(event.target.value)}
                  />
                  <TextField
                    label="Code (optional)"
                    name="subjectCode"
                    autoComplete="off"
                    value={subjectCode}
                    onChange={(event) => setSubjectCode(event.target.value)}
                  />
                  <Button type="submit" loading={creatingSubject}>
                    {creatingSubject ? "Adding…" : "Add subject"}
                  </Button>
                </form>
              ) : (
                <Alert variant="info">Your role cannot change subjects.</Alert>
              )}

              {subjects === null ? (
                subjectError === null ? (
                  <p className="muted" role="status">
                    Loading subjects…
                  </p>
                ) : null
              ) : subjects.length === 0 ? (
                <p className="muted">No subjects yet.</p>
              ) : (
                <ul className="record-list">
                  {subjects.map((subject) => (
                    <li className="record" key={subject.id}>
                      <div className="record__main">
                        {editingSubjectId === subject.id ? (
                          <form
                            className="inline-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void handleSaveSubject(subject);
                            }}
                            noValidate
                          >
                            <TextField
                              label="Subject name"
                              name={`subject-name-${subject.id}`}
                              autoComplete="off"
                              value={editSubjectName}
                              onChange={(event) =>
                                setEditSubjectName(event.target.value)
                              }
                            />
                            <TextField
                              label="Code (optional)"
                              name={`subject-code-${subject.id}`}
                              autoComplete="off"
                              value={editSubjectCode}
                              onChange={(event) =>
                                setEditSubjectCode(event.target.value)
                              }
                            />
                            <Button
                              type="submit"
                              size="sm"
                              loading={busyId === subject.id}
                            >
                              Save subject
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingSubjectId(null)}
                            >
                              Cancel
                            </Button>
                          </form>
                        ) : (
                          <>
                            <p className="record__title">
                              {subject.name}
                              {subject.code ? (
                                <span className="muted"> ({subject.code})</span>
                              ) : null}
                            </p>
                            <p className="record__meta">
                              <span
                                className={`badge badge--${subject.isActive ? "active" : "inactive"}`}
                              >
                                {subject.isActive ? "Active" : "Inactive"}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                      {canManageSubjects && editingSubjectId !== subject.id ? (
                        <div className="record__actions">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingSubjectId(subject.id);
                              setEditSubjectName(subject.name);
                              setEditSubjectCode(subject.code ?? "");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant={subject.isActive ? "danger" : "secondary"}
                            size="sm"
                            loading={busyId === subject.id}
                            onClick={() => void handleToggleSubject(subject)}
                          >
                            {subject.isActive ? "Deactivate" : "Reactivate"}
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

        {/* Grading bands */}
        {canReadGrading ? (
          <Card>
            <CardHeader
              title="Grading bands"
              description="Your school’s own grading scale. Without bands, marks are still recorded and reported as percentages."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setBands(null);
                    setSubjectKey((key) => key + 1);
                  }}
                  loading={bands === null && bandError === null}
                >
                  Refresh
                </Button>
              }
            />
            <CardBody className="stack stack--sm">
              {bandNotice ? (
                <Alert variant="success">{bandNotice}</Alert>
              ) : null}
              {bandError ? <Alert variant="error">{bandError}</Alert> : null}

              <Alert variant="info">
                A band covers everything from its minimum up to the next band.
                Add bands from the lowest upwards: a new band that falls inside
                an existing one is refused, because it would quietly change what
                last term&rsquo;s grades mean.
              </Alert>

              {canManageGrading ? (
                <form
                  className="inline-form"
                  onSubmit={handleCreateBand}
                  noValidate
                >
                  <TextField
                    label="Minimum %"
                    name="bandMin"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    required
                    value={bandMin}
                    onChange={(event) => setBandMin(event.target.value)}
                  />
                  <TextField
                    label="Label"
                    name="bandLabel"
                    autoComplete="off"
                    required
                    value={bandLabel}
                    onChange={(event) => setBandLabel(event.target.value)}
                  />
                  <TextField
                    label="Remark (optional)"
                    name="bandRemark"
                    autoComplete="off"
                    value={bandRemark}
                    onChange={(event) => setBandRemark(event.target.value)}
                  />
                  <span className="cluster">
                    <input
                      id="band-passing"
                      type="checkbox"
                      checked={bandPassing}
                      onChange={(event) => setBandPassing(event.target.checked)}
                    />
                    <label htmlFor="band-passing">Counts as passing</label>
                  </span>
                  <Button type="submit" loading={creatingBand}>
                    {creatingBand ? "Adding…" : "Add band"}
                  </Button>
                </form>
              ) : (
                <Alert variant="info">
                  Your role can see the grading scale but not change it.
                </Alert>
              )}

              {bands === null ? (
                bandError === null ? (
                  <p className="muted" role="status">
                    Loading grading bands…
                  </p>
                ) : null
              ) : bands.length === 0 ? (
                <Alert variant="info">
                  No grading bands configured. Marks will be recorded and
                  reported as percentages only.
                </Alert>
              ) : (
                <ul className="record-list">
                  {bands.map((band) => (
                    <li key={band.id} className="record">
                      <div className="record__main">
                        <p className="record__title">{band.label}</p>
                        <p className="record__meta">
                          {band.minPercentage}% and above
                          {band.remark ? ` · ${band.remark}` : ""}
                          {band.isPassing ? "" : " · does not count as passing"}
                        </p>
                      </div>
                      {canManageGrading ? (
                        <div className="record__actions">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busyBandId === band.id}
                            onClick={() => void handleToggleBandPassing(band)}
                          >
                            {band.isPassing ? "Not passing" : "Passing"}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            loading={busyBandId === band.id}
                            onClick={() => void handleDeleteBand(band)}
                          >
                            Remove
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
    </>
  );
}
