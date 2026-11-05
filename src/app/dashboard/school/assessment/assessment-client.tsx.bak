"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { parseGradeBandCreateInput } from "@/lib/academics/requests";
import type { GradeBandSummary } from "@/lib/academics/types";
import {
  parseSubjectCreateInput,
  parseSubjectUpdateInput,
} from "@/lib/administration/requests";
import type { SubjectSummary } from "@/lib/administration/types";

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

type PostResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

type Mode = "ges_standard" | "custom";

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

export function AssessmentClient({
  canReadSubjects,
  canManageSubjects,
  canReadGrading,
  canManageGrading,
}: {
  readonly canReadSubjects: boolean;
  readonly canManageSubjects: boolean;
  readonly canReadGrading: boolean;
  readonly canManageGrading: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [modeError, setModeError] = useState<string | null>(null);

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
  const [busyId, setBusyId] = useState<string | null>(null);

  const [bands, setBands] = useState<GradeBandSummary[] | null>(null);
  const [bandError, setBandError] = useState<string | null>(null);
  const [bandNotice, setBandNotice] = useState<string | null>(null);
  const [bandKey, setBandKey] = useState(0);
  const [bandMin, setBandMin] = useState("");
  const [bandLabel, setBandLabel] = useState("");
  const [bandRemark, setBandRemark] = useState("");
  const [bandPassing, setBandPassing] = useState(true);
  const [creatingBand, setCreatingBand] = useState(false);
  const [busyBandId, setBusyBandId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getJson(
        "/api/staff/school/assessment-mode",
        (payload) => {
          const value = payload["mode"];
          return value === "ges_standard" || value === "custom" ? value : null;
        },
      );
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setMode(result.value);
      } else {
        setModeError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode !== "custom" || !canReadSubjects) {
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
  }, [canReadSubjects, mode, subjectKey]);

  useEffect(() => {
    if (mode !== "custom" || !canReadGrading) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getJson(
        "/api/staff/grade-bands",
        (payload) => (payload["bands"] as GradeBandSummary[] | undefined) ?? null,
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
  }, [bandKey, canReadGrading, mode]);

  function reloadSubjects() {
    setSubjects(null);
    setSubjectKey((key) => key + 1);
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
    setBandKey((key) => key + 1);
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
    setBandKey((key) => key + 1);
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
    setBandKey((key) => key + 1);
  }

  return (
    <div className="container stack">
      <div className="stack stack--sm">
        <p style={{ margin: 0 }}>
          <Link className="btn btn--ghost btn--sm" href="/dashboard/school">
            <span aria-hidden="true">←</span> Back to school settings
          </Link>
        </p>
        <h1>Custom assessment framework</h1>
        <p className="muted">
          Configure the subjects and grade boundaries your school uses. These
          settings apply only to this school and only while Fully custom is the
          active assessment mode.
        </p>
      </div>

      {modeError ? <Alert variant="error">{modeError}</Alert> : null}

      {mode === null ? (
        modeError === null ? (
          <p className="muted" role="status">
            Loading the assessment framework…
          </p>
        ) : null
      ) : mode === "ges_standard" ? (
        <Card>
          <CardHeader
            title="The GES / NaCCA standard is active"
            description="Your school uses the read-only GES preset. Custom subjects and grade bands are not applied while that preset is active."
          />
          <CardBody className="stack stack--sm">
            <Alert variant="info">
              Switch to <strong>Fully custom</strong> in school settings before
              configuring your own subjects and grading scale.
            </Alert>
            <div className="cluster cluster--end">
              <Link className="btn btn--primary" href="/dashboard/school">
                Go to school settings
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <>
          {!canReadSubjects && !canReadGrading ? (
            <Alert variant="info">
              Your role cannot view the custom framework configuration.
            </Alert>
          ) : null}

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
                                  <span className="muted">
                                    {" "}
                                    ({subject.code})
                                  </span>
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
                        {canManageSubjects &&
                        editingSubjectId !== subject.id ? (
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
                      setBandKey((key) => key + 1);
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
                  an existing one is refused, because it would quietly change
                  what last term&rsquo;s grades mean.
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
                        onChange={(event) =>
                          setBandPassing(event.target.checked)
                        }
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
                            {band.isPassing
                              ? ""
                              : " · does not count as passing"}
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
        </>
      )}
    </div>
  );
}
