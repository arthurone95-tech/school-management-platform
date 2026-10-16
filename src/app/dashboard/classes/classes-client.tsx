"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import {
  parseClassCreateInput,
  parseClassUpdateInput,
} from "@/lib/enrolment/requests";
import type { ClassSummary } from "@/lib/enrolment/types";
import { roleLabel } from "@/lib/staff/roles";

type ListState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly classes: ClassSummary[] }
  | { readonly kind: "error"; readonly message: string };

const NETWORK_MESSAGE =
  "Could not reach the server. Check your connection and try again.";

/**
 * Every class, including deactivated ones: this page is where a class is
 * reactivated, so it must show inactive classes too (D-028).
 */
async function fetchClasses(): Promise<ListState> {
  let response: Response;
  try {
    response = await fetch("/api/staff/classes?includeInactive=true", {
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

export function ClassesClient({
  email,
  role,
  schoolName,
  canRead,
  canManage,
  canViewStudents,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canRead: boolean;
  readonly canManage: boolean;
  readonly canViewStudents: boolean;
}) {
  const router = useRouter();

  const [listState, setListState] = useState<ListState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!canRead) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = await fetchClasses();
      if (!cancelled) {
        setListState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canRead, reloadKey]);

  function reloadList() {
    setListState({ kind: "loading" });
    setReloadKey((key) => key + 1);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setNotice(null);

    const parsed = parseClassCreateInput({ name: newName });
    if (!parsed.ok) {
      setCreateError(parsed.message);
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/staff/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
        readonly klass?: ClassSummary;
      };

      if (!response.ok || payload.ok !== true || !payload.klass) {
        setCreateError(payload.error ?? "The class could not be created.");
        return;
      }

      setNewName("");
      setNotice(`Created ${payload.klass.name}.`);
      reloadList();
    } catch {
      setCreateError(NETWORK_MESSAGE);
    } finally {
      setCreating(false);
    }
  }

  /**
   * Sends one class change. `body` is already validated by the caller, so the
   * request carries exactly the validated value (the wire format cannot drift
   * from what was checked).
   */
  async function sendClassUpdate(body: {
    readonly classId: string;
    readonly name?: string;
    readonly isActive?: boolean;
  }): Promise<boolean> {
    const parsed = parseClassUpdateInput(body);
    if (!parsed.ok) {
      setActionError(parsed.message);
      return false;
    }

    setActionError(null);
    setBusyId(parsed.value.classId);
    try {
      const response = await fetch("/api/staff/classes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
      };

      if (!response.ok || payload.ok !== true) {
        setActionError(payload.error ?? "The class could not be updated.");
        return false;
      }

      return true;
    } catch {
      setActionError(NETWORK_MESSAGE);
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function handleRename(klass: ClassSummary) {
    const parsed = parseClassUpdateInput({
      classId: klass.id,
      name: editName,
    });
    if (!parsed.ok) {
      setActionError(parsed.message);
      return;
    }
    if (parsed.value.name === klass.name) {
      setEditingId(null);
      setActionError(null);
      return;
    }

    if (await sendClassUpdate({ classId: klass.id, name: editName })) {
      setEditingId(null);
      setNotice(`Renamed ${klass.name}.`);
      reloadList();
    }
  }

  async function handleToggleActive(klass: ClassSummary) {
    const next = !klass.isActive;
    if (await sendClassUpdate({ classId: klass.id, isActive: next })) {
      setConfirmingId(null);
      setNotice(
        next ? `Reactivated ${klass.name}.` : `Deactivated ${klass.name}.`,
      );
      reloadList();
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

  const classes = listState.kind === "ready" ? listState.classes : [];

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
            {canViewStudents ? (
              <Link
                className="btn btn--secondary btn--sm"
                href="/dashboard/learners"
              >
                Students
              </Link>
            ) : null}
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
          <h1>Classes</h1>
          <p className="muted">
            Classes belong to your school. A student is placed in one active
            class at a time. Deactivating a class hides it from new enrolment
            but keeps existing placements.
          </p>
        </div>

        {!canRead ? (
          <Alert variant="info">Your role cannot view classes yet.</Alert>
        ) : (
          <>
            {!canManage ? (
              <Alert variant="info">
                Your role cannot change classes. Only a school administrator can
                create, rename or deactivate a class.
              </Alert>
            ) : (
              <Card>
                <CardHeader
                  title="Create a class"
                  description="Class names are unique within your school. Only a new enrolment can use an active class."
                />
                <CardBody className="stack stack--sm">
                  {notice ? <Alert variant="success">{notice}</Alert> : null}
                  {createError ? (
                    <Alert variant="error">{createError}</Alert>
                  ) : null}
                  <form
                    className="inline-form"
                    onSubmit={handleCreate}
                    noValidate
                  >
                    <TextField
                      label="Class name"
                      name="className"
                      autoComplete="off"
                      required
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                    />
                    <Button type="submit" loading={creating}>
                      {creating ? "Creating…" : "Create class"}
                    </Button>
                  </form>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardHeader
                title="Your classes"
                description={
                  listState.kind === "ready" && listState.classes.length > 0
                    ? `${listState.classes.length} class${listState.classes.length === 1 ? "" : "es"} in your school.`
                    : "The classes belonging to your school."
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
              {actionError ? (
                <CardBody>
                  <Alert variant="error">{actionError}</Alert>
                </CardBody>
              ) : listState.kind === "error" ? (
                <CardBody>
                  <Alert variant="error">{listState.message}</Alert>
                </CardBody>
              ) : listState.kind === "loading" ? (
                <CardBody>
                  <p className="muted" role="status">
                    Loading classes…
                  </p>
                </CardBody>
              ) : classes.length === 0 ? (
                <CardBody>
                  <p className="muted">
                    No classes yet. A student cannot be placed until a class
                    exists.
                  </p>
                </CardBody>
              ) : (
                <ul className="record-list">
                  {classes.map((klass) => (
                    <li className="record" key={klass.id}>
                      <div className="record__main">
                        {editingId === klass.id ? (
                          <div className="stack stack--sm">
                            <TextField
                              label="Class name"
                              name={`rename-${klass.id}`}
                              autoComplete="off"
                              value={editName}
                              onChange={(event) =>
                                setEditName(event.target.value)
                              }
                            />
                            <div className="cluster">
                              <Button
                                size="sm"
                                loading={busyId === klass.id}
                                onClick={() => handleRename(klass)}
                              >
                                Save name
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingId(null);
                                  setActionError(null);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="record__title">{klass.name}</p>
                            <p className="record__meta">
                              <span
                                className={`badge badge--${klass.isActive ? "active" : "inactive"}`}
                              >
                                {klass.isActive ? "Active" : "Inactive"}
                              </span>
                            </p>
                          </>
                        )}
                      </div>
                      {canManage && editingId !== klass.id ? (
                        <div className="record__actions">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingId(klass.id);
                              setEditName(klass.name);
                              setConfirmingId(null);
                              setActionError(null);
                            }}
                          >
                            Rename
                          </Button>
                          {klass.isActive ? (
                            confirmingId === klass.id ? (
                              <>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  loading={busyId === klass.id}
                                  onClick={() => handleToggleActive(klass)}
                                >
                                  Confirm deactivate
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmingId(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                  setConfirmingId(klass.id);
                                  setActionError(null);
                                }}
                              >
                                Deactivate
                              </Button>
                            )
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={busyId === klass.id}
                              onClick={() => handleToggleActive(klass)}
                            >
                              Reactivate
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </>
  );
}
