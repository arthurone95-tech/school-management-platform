"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SelectField } from "@/components/ui/form";
import { AUDIT_PAGE_SIZE, type AuditEventPage } from "@/lib/audit/types";
import {
  auditActionLabel,
  auditTableLabel,
  formatDateTime,
} from "@/lib/domain/display";
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

function StaffPrintableList({
  members,
  schoolName,
}: {
  readonly members: readonly StaffMemberSummary[];
  readonly schoolName: string | null;
}) {
  return (
    <div className="terminal-report-card">
      <h2>Staff list</h2>
      <p className="muted">{schoolName ?? "School"}</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Last sign-in</th>
              <th>Assignments</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.membershipId}>
                <td>{member.email ?? "Unknown account"}</td>
                <td>{roleLabel(member.role)}</td>
                <td>{STATUS_LABELS[member.status] ?? member.status}</td>
                <td>{formatDateTime(member.joinedAt)}</td>
                <td>{formatDateTime(member.lastSignInAt)}</td>
                <td>
                  {member.assignments.length === 0
                    ? "None"
                    : member.assignments
                        .map((assignment) =>
                          [assignment.className, assignment.subjectName]
                            .filter(Boolean)
                            .join(" · "),
                        )
                        .join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StaffClient({
  email,
  role,
  schoolName,
  canManageMembers,
  canViewClasses,
  canViewSubjects,
  canViewStudents,
  canViewAcademic,
  canReadAudit,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canManageMembers: boolean;
  readonly canViewClasses: boolean;
  readonly canViewSubjects: boolean;
  readonly canViewStudents: boolean;
  readonly canViewAcademic: boolean;
  readonly canReadAudit: boolean;
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
  const [printRequested, setPrintRequested] = useState(false);
  const [audit, setAudit] = useState<AuditEventPage | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);

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

  useEffect(() => {
    if (!canReadAudit) {
      return;
    }
    let cancelled = false;
    void (async () => {
      let response: Response;
      try {
        response = await fetch(`/api/staff/audit?page=${auditPage}`, {
          headers: { Accept: "application/json" },
        });
      } catch {
        if (!cancelled) {
          setAudit(null);
          setAuditError(NETWORK_MESSAGE);
        }
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
        readonly events?: AuditEventPage["events"];
        readonly page?: number;
        readonly total?: number;
      };
      if (
        cancelled ||
        !response.ok ||
        payload.ok !== true ||
        !payload.events ||
        typeof payload.total !== "number"
      ) {
        if (!cancelled) {
          setAudit(null);
          setAuditError(payload.error ?? "The activity log could not be loaded.");
        }
        return;
      }
      setAudit({
        events: payload.events,
        page:
          typeof payload.page === "number" ? payload.page : auditPage,
        pageSize: AUDIT_PAGE_SIZE,
        total: payload.total,
      });
      setAuditError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [canReadAudit, auditPage, reloadKey]);

  function reloadMembers() {
    setMembers(null);
    setReloadKey((key) => key + 1);
  }

  function printStaffList() {
    setPrintRequested(true);
    // Let the print-only table commit before opening the browser dialog.
    window.setTimeout(() => {
      window.print();
      setPrintRequested(false);
    }, 0);
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

  const accessRights = [
    { label: "Manage staff and assignments", allowed: canManageMembers },
    { label: "View classes", allowed: canViewClasses },
    { label: "View subjects", allowed: canViewSubjects },
    { label: "View students", allowed: canViewStudents },
    { label: "View academic settings", allowed: canViewAcademic },
    { label: "View activity log", allowed: canReadAudit },
  ];

  const auditTotalPages =
    audit && audit.total > 0
      ? Math.max(1, Math.ceil(audit.total / audit.pageSize))
      : 1;

  return (
    <>
      <div className="container stack">
        <PageHeader
          title="Staff"
          description="The staff in your school, their access and the classes and subjects they are assigned to. Suspending or revoking a member removes access immediately and is never a deletion."
        />

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
                <div className="cluster">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={reloadMembers}
                    loading={members === null}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!members || members.length === 0}
                    onClick={printStaffList}
                  >
                    Print list
                  </Button>
                </div>
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
                        <p className="record__meta">
                          Joined {formatDateTime(member.joinedAt)} · Last sign-in{" "}
                          {formatDateTime(member.lastSignInAt)}
        
                        {member.healthStatus ? (
                          <p className="record__meta">
                            Health status: {member.healthStatus}
                          </p>
                        ) : null}                </p>

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

        <Card>
          <CardHeader
            title="Your access rights"
            description={`Signed in as ${roleLabel(role)}. These rights come from the school's permission catalogue and are checked again on the server.`}
          />
          <CardBody>
            <ul className="record-list">
              {accessRights.map((right) => (
                <li className="record" key={right.label}>
                  <div className="record__main">
                    <p className="record__title">{right.label}</p>
                  </div>
                  <div className="record__actions">
                    <Badge variant={right.allowed ? "success" : "neutral"}>
                      {right.allowed ? "Allowed" : "Not allowed"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {canReadAudit ? (
          <Card>
            <CardHeader
              title="Recent school activity"
              description="Who created or edited a record. The audit trail stores changed field names, never the personal values themselves."
              actions={
                <div className="cluster">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setAudit(null);
                      setReloadKey((key) => key + 1);
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              }
            />
            <CardBody className="stack stack--sm">
              {auditError ? (
                <Alert variant="error">{auditError}</Alert>
              ) : audit === null ? (
                <p className="muted" role="status">
                  Loading activity…
                </p>
              ) : audit.events.length === 0 ? (
                <p className="muted">No activity recorded yet.</p>
              ) : (
                <ul className="record-list">
                  {audit.events.map((event) => (
                    <li className="record" key={event.id}>
                      <div className="record__main">
                        <p className="record__title">
                          {auditActionLabel(event.action)} ·{" "}
                          {auditTableLabel(event.targetTable)}
                        </p>
                        <p className="record__meta">
                          <span>
                            {event.actorEmail ?? "Unknown account"}
                          </span>
                          <span>{formatDateTime(event.createdAt)}</span>
                          <span className="mono">{event.targetId}</span>
                        </p>
                        <p className="muted">
                          {event.changedColumns.length === 0
                            ? "No field detail recorded."
                            : `Changed: ${event.changedColumns.join(", ")}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {audit && auditTotalPages > 1 ? (
                <div className="card__footer cluster cluster--end">
                  <span className="muted">
                    Page {audit.page} of {auditTotalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={audit.page <= 1}
                    onClick={() => setAuditPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={audit.page >= auditTotalPages}
                    onClick={() =>
                      setAuditPage((page) => Math.min(auditTotalPages, page + 1))
                    }
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {printRequested && members ? (
          <StaffPrintableList members={members} schoolName={schoolName} />
        ) : null}
      </div>
    </>
  );

  function confirmingRevoke(member: StaffMemberSummary): boolean {
    return confirmingId === member.membershipId;
  }
}
