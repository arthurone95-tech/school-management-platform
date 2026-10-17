"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/form";
import {
  parseAssignmentCreateInput,
  parseAssignmentDeleteInput,
  parseMemberStatusInput,
  type MemberStatusAction,
} from "@/lib/administration/requests";
import type {
  StaffAssignmentSummary,
  StaffMemberSummary,
} from "@/lib/administration/types";
import type { ClassSummary } from "@/lib/enrolment/types";
import type { SubjectSummary } from "@/lib/administration/types";
import { roleLabel } from "@/lib/staff/roles";

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  invited: "Invitation pending",
  suspended: "Suspended",
  revoked: "Revoked",
};

function statusBadgeVariant(status: string): string {
  if (status === "active") {
    return "active";
  }
  if (status === "invited") {
    return "pending";
  }
  return "inactive";
}

async function getList<T>(
  url: string,
  key: string,
): Promise<{ ok: true; value: T[] } | { ok: false; message: string }> {
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
  const value = payload[key];
  if (!response.ok || payload.ok !== true || !Array.isArray(value)) {
    const error = payload["error"];
    return {
      ok: false,
      message:
        typeof error === "string" ? error : "The data could not be loaded.",
    };
  }
  return { ok: true, value: value as T[] };
}

async function postJson(
  url: string,
  body: unknown,
): Promise<{ ok: true } | { ok: false; message: string }> {
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

const ACTION_VERB: Record<MemberStatusAction, string> = {
  suspend: "Suspended",
  restore: "Restored",
  revoke: "Revoked",
};

export function StaffClient({
  email,
  role,
  schoolName,
  canManageMembers,
  canViewClasses,
  canViewSubjects,
  canViewStudents,
  canViewAcademic,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canManageMembers: boolean;
  readonly canViewClasses: boolean;
  readonly canViewSubjects: boolean;
  readonly canViewStudents: boolean;
  readonly canViewAcademic: boolean;
}) {
  const router = useRouter();

  const [members, setMembers] = useState<StaffMemberSummary[] | null>(null);
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [assigningMemberId, setAssigningMemberId] = useState<string | null>(
    null,
  );
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSubjectId, setAssignSubjectId] = useState("");

  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!canManageMembers) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getList<StaffMemberSummary>(
        "/api/staff/members",
        "members",
      );
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setMembers(result.value);
        setMembersError(null);
      } else {
        setMembers(null);
        setMembersError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageMembers, reloadKey]);

  useEffect(() => {
    if (!canManageMembers) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const [classesResult, subjectsResult] = await Promise.all([
        canViewClasses
          ? getList<ClassSummary>("/api/staff/classes", "classes")
          : Promise.resolve({ ok: true as const, value: [] as ClassSummary[] }),
        canViewSubjects
          ? getList<SubjectSummary>("/api/staff/subjects", "subjects")
          : Promise.resolve({
              ok: true as const,
              value: [] as SubjectSummary[],
            }),
      ]);
      if (cancelled) {
        return;
      }
      if (classesResult.ok) {
        setClasses(classesResult.value.filter((klass) => klass.isActive));
      }
      if (subjectsResult.ok) {
        setSubjects(subjectsResult.value.filter((subject) => subject.isActive));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageMembers, canViewClasses, canViewSubjects, reloadKey]);

  function reloadMembers() {
    setMembers(null);
    setReloadKey((key) => key + 1);
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

  async function applyStatus(
    member: StaffMemberSummary,
    action: MemberStatusAction,
  ) {
    setActionError(null);
    setNotice(null);

    const parsed = parseMemberStatusInput({
      membershipId: member.membershipId,
      action,
    });
    if (!parsed.ok) {
      setActionError(parsed.message);
      return;
    }

    setBusyId(member.membershipId);
    const result = await postJson("/api/staff/members/status", parsed.value);
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setConfirmingId(null);
    setNotice(`${ACTION_VERB[action]} ${member.email ?? "the staff member"}.`);
    reloadMembers();
  }

  async function handleAssign(
    event: FormEvent<HTMLFormElement>,
    member: StaffMemberSummary,
  ) {
    event.preventDefault();
    setActionError(null);
    setNotice(null);

    const parsed = parseAssignmentCreateInput({
      membershipId: member.membershipId,
      classId: assignClassId === "" ? null : assignClassId,
      subjectId: assignSubjectId === "" ? null : assignSubjectId,
    });
    if (!parsed.ok) {
      setActionError(parsed.message);
      return;
    }

    setBusyId(member.membershipId);
    const result = await postJson("/api/staff/assignments", parsed.value);
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setAssigningMemberId(null);
    setAssignClassId("");
    setAssignSubjectId("");
    setNotice("Assignment added.");
    reloadMembers();
  }

  async function handleDeleteAssignment(
    member: StaffMemberSummary,
    assignment: StaffAssignmentSummary,
  ) {
    setActionError(null);
    setNotice(null);

    const parsed = parseAssignmentDeleteInput({
      assignmentId: assignment.id,
    });
    if (!parsed.ok) {
      setActionError(parsed.message);
      return;
    }

    setBusyId(member.membershipId);
    const result = await postJson(
      "/api/staff/assignments/delete",
      parsed.value,
    );
    setBusyId(null);
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    setNotice("Assignment removed.");
    reloadMembers();
  }

  const classOptions = classes.map((klass) => ({
    value: klass.id,
    label: klass.name,
  }));
  const subjectOptions = subjects.map((subject) => ({
    value: subject.id,
    label: subject.name,
  }));

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
            {canViewClasses ? (
              <Link
                className="btn btn--secondary btn--sm"
                href="/dashboard/classes"
              >
                Classes
              </Link>
            ) : null}
            {canViewAcademic ? (
              <Link
                className="btn btn--secondary btn--sm"
                href="/dashboard/school"
              >
                Settings
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
          <h1>Staff</h1>
          <p className="muted">
            The staff in your school, their access and the classes and subjects
            they are assigned to. Suspending or revoking a member removes access
            immediately and is never a deletion.
          </p>
        </div>

        {!canManageMembers ? (
          <Alert variant="info">
            Your role cannot manage staff. Only a school administrator can
            suspend, restore or revoke a member.
          </Alert>
        ) : (
          <Card>
            <CardHeader
              title="Staff members"
              description={
                members
                  ? `${members.length} member${members.length === 1 ? "" : "s"} in your school.`
                  : "The staff belonging to your school."
              }
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={reloadMembers}
                  loading={members === null}
                >
                  Refresh
                </Button>
              }
            />
            <CardBody className="stack stack--sm">
              {notice ? <Alert variant="success">{notice}</Alert> : null}
              {actionError ? (
                <Alert variant="error">{actionError}</Alert>
              ) : null}
              {membersError ? (
                <Alert variant="error">{membersError}</Alert>
              ) : null}

              {members === null ? (
                membersError === null ? (
                  <p className="muted" role="status">
                    Loading staff…
                  </p>
                ) : null
              ) : members.length === 0 ? (
                <p className="muted">
                  No staff members yet. Invite a teacher from the dashboard.
                </p>
              ) : (
                <ul className="record-list">
                  {members.map((member) => (
                    <li className="record" key={member.membershipId}>
                      <div className="record__main">
                        <p className="record__title">
                          {member.email ?? "Unknown account"}
                        </p>
                        <p className="record__meta">
                          {roleLabel(member.role)}
                          {" · "}
                          <span
                            className={`badge badge--${statusBadgeVariant(member.status)}`}
                          >
                            {STATUS_LABELS[member.status] ?? member.status}
                          </span>
                        </p>

                        <div className="stack stack--sm">
                          {member.assignments.length === 0 ? (
                            <p className="muted">No assignments.</p>
                          ) : (
                            <ul className="record-list">
                              {member.assignments.map((assignment) => (
                                <li className="record" key={assignment.id}>
                                  <div className="record__main">
                                    <p className="record__title">
                                      {[
                                        assignment.className,
                                        assignment.subjectName,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "Assignment"}
                                    </p>
                                  </div>
                                  <div className="record__actions">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      loading={busyId === member.membershipId}
                                      onClick={() =>
                                        void handleDeleteAssignment(
                                          member,
                                          assignment,
                                        )
                                      }
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}

                          {assigningMemberId === member.membershipId ? (
                            <form
                              className="inline-form"
                              onSubmit={(event) =>
                                void handleAssign(event, member)
                              }
                              noValidate
                            >
                              <SelectField
                                label="Class"
                                name={`assign-class-${member.membershipId}`}
                                options={[
                                  { value: "", label: "No class" },
                                  ...classOptions,
                                ]}
                                value={assignClassId}
                                onChange={(event) =>
                                  setAssignClassId(event.target.value)
                                }
                              />
                              <SelectField
                                label="Subject"
                                name={`assign-subject-${member.membershipId}`}
                                options={[
                                  { value: "", label: "No subject" },
                                  ...subjectOptions,
                                ]}
                                value={assignSubjectId}
                                onChange={(event) =>
                                  setAssignSubjectId(event.target.value)
                                }
                              />
                              <Button
                                type="submit"
                                size="sm"
                                loading={busyId === member.membershipId}
                              >
                                Add assignment
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAssigningMemberId(null)}
                              >
                                Cancel
                              </Button>
                            </form>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setAssigningMemberId(member.membershipId);
                                setAssignClassId("");
                                setAssignSubjectId("");
                              }}
                            >
                              Add assignment
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="record__actions">
                        {member.status === "active" ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busyId === member.membershipId}
                            onClick={() => void applyStatus(member, "suspend")}
                          >
                            Suspend
                          </Button>
                        ) : member.status === "invited" ? null : (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busyId === member.membershipId}
                            onClick={() => void applyStatus(member, "restore")}
                          >
                            Restore
                          </Button>
                        )}

                        {member.status === "revoked" ? null : confirmingRevoke(
                            member,
                          ) ? (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={busyId === member.membershipId}
                              onClick={() => void applyStatus(member, "revoke")}
                            >
                              Confirm revoke
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
                              setConfirmingId(member.membershipId);
                              setActionError(null);
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );

  function confirmingRevoke(member: StaffMemberSummary): boolean {
    return confirmingId === member.membershipId;
  }
}
