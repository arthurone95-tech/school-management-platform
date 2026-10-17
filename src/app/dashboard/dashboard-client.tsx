"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField, TextField } from "@/components/ui/form";
import { InvitationStatusBadge } from "@/components/ui/status-badge";
import type { InvitationStatus } from "@/lib/staff/invitation-status";
import { parseStaffInviteInput } from "@/lib/staff/requests";
import { roleLabel, STAFF_ROLE_OPTIONS } from "@/lib/staff/roles";

interface InvitationSummary {
  readonly invitationId: string;
  readonly email: string;
  readonly role: string;
  readonly status: InvitationStatus;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly revokedAt: string | null;
}

interface IssuedLink {
  readonly email: string;
  readonly role: string;
  readonly activationLink: string;
  readonly expiresAt: string;
}

type ListState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly invitations: InvitationSummary[] }
  | { readonly kind: "error"; readonly message: string };

const DEFAULT_INVITE_ROLE = "teacher";

/**
 * Timestamps are formatted in UTC with a fixed locale so the server and the
 * browser render identical text (no hydration mismatch). The platform's first
 * market is Ghana, which is on UTC+0.
 */
function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

function statusDetail(invitation: InvitationSummary): string {
  switch (invitation.status) {
    case "pending":
      return `Expires ${formatDateTime(invitation.expiresAt)}`;
    case "expired":
      return `Expired ${formatDateTime(invitation.expiresAt)}`;
    case "accepted":
      return invitation.acceptedAt
        ? `Accepted ${formatDateTime(invitation.acceptedAt)}`
        : "Accepted";
    case "revoked":
      return invitation.revokedAt
        ? `Revoked ${formatDateTime(invitation.revokedAt)}`
        : "Revoked";
  }
}

async function loadInvitations(): Promise<ListState> {
  let response: Response;
  try {
    response = await fetch("/api/staff/invitations", {
      headers: { Accept: "application/json" },
    });
  } catch {
    return {
      kind: "error",
      message:
        "Could not reach the server. Check your connection and try again.",
    };
  }

  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
    readonly invitations?: InvitationSummary[];
  };

  if (!response.ok || payload.ok !== true || !payload.invitations) {
    return {
      kind: "error",
      message: payload.error ?? "The invitations could not be loaded.",
    };
  }

  return { kind: "ready", invitations: payload.invitations };
}

export function DashboardClient({
  email,
  role,
  schoolName,
  canManageMembers,
  canViewStudents,
  canManageClasses,
  canViewSettings,
  canViewAttendance,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canManageMembers: boolean;
  readonly canViewStudents: boolean;
  readonly canManageClasses: boolean;
  readonly canViewSettings: boolean;
  readonly canViewAttendance: boolean;
}) {
  const router = useRouter();

  const [listState, setListState] = useState<ListState>({ kind: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>(DEFAULT_INVITE_ROLE);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const next = await loadInvitations();
      if (!cancelled) {
        setListState(next);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function refreshList() {
    setListState({ kind: "loading" });
    setReloadKey((key) => key + 1);
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteError(null);
    setNotice(null);
    setCopied(false);
    setCopyError(null);

    const parsed = parseStaffInviteInput({
      email: inviteEmail,
      role: inviteRole,
    });
    if (!parsed.ok) {
      setInviteError(parsed.message);
      return;
    }

    setInviting(true);
    try {
      const response = await fetch("/api/staff/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
        readonly email?: string;
        readonly role?: string;
        readonly expiresAt?: string;
        readonly activationLink?: string;
      };

      if (
        !response.ok ||
        payload.ok !== true ||
        !payload.email ||
        !payload.role ||
        !payload.expiresAt ||
        !payload.activationLink
      ) {
        setInviteError(payload.error ?? "The invitation could not be created.");
        return;
      }

      setIssued({
        email: payload.email,
        role: payload.role,
        expiresAt: payload.expiresAt,
        activationLink: payload.activationLink,
      });
      setInviteEmail("");
      refreshList();
    } catch {
      setInviteError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setInviting(false);
    }
  }

  async function handleCopy() {
    if (!issued) {
      return;
    }
    try {
      await navigator.clipboard.writeText(issued.activationLink);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopied(false);
      setCopyError(
        "Copying is not available in this browser. Select the link and copy it manually.",
      );
    }
  }

  async function handleRevoke(invitationId: string) {
    setActionError(null);
    setBusyId(invitationId);
    try {
      const response = await fetch("/api/staff/invitations/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        readonly ok?: boolean;
        readonly error?: string;
      };

      if (!response.ok || payload.ok !== true) {
        setActionError(payload.error ?? "The invitation could not be revoked.");
        return;
      }

      setConfirmingId(null);
      refreshList();
    } catch {
      setActionError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function handleReinvite(invitation: InvitationSummary) {
    setInviteEmail(invitation.email);
    setInviteRole(invitation.role);
    setInviteError(null);
    setNotice(
      `Adjust the role if needed, then create a new link for ${invitation.email}. The previous link stops working immediately.`,
    );
    document
      .getElementById("invite-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("invite-email")?.focus();
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

  const invitations = listState.kind === "ready" ? listState.invitations : [];

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
            {canManageClasses ? (
              <Link
                className="btn btn--secondary btn--sm"
                href="/dashboard/classes"
              >
                Classes
              </Link>
            ) : null}
            {canManageMembers ? (
              <Link
                className="btn btn--secondary btn--sm"
                href="/dashboard/staff"
              >
                Staff
              </Link>
            ) : null}
            {canViewAttendance ? (
              <Link
                className="btn btn--secondary btn--sm"
                href="/dashboard/attendance"
              >
                Attendance
              </Link>
            ) : null}
            {canViewSettings ? (
              <Link
                className="btn btn--secondary btn--sm"
                href="/dashboard/school"
              >
                Settings
              </Link>
            ) : null}
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
          <h1>Staff invitations</h1>
          <p className="muted">
            Invite a colleague by creating a single-use activation link, then
            share it with them directly. No email is sent.
          </p>
        </div>

        {!canManageMembers ? (
          <Alert variant="info">
            Your role does not manage staff members yet. An invitation can only
            be created by a school administrator.
          </Alert>
        ) : null}

        <Card>
          <CardHeader
            title="Invite a staff member"
            description="The recipient sets their own password when they open the link."
          />
          <CardBody className="stack stack--sm">
            {notice ? <Alert variant="info">{notice}</Alert> : null}
            {inviteError ? <Alert variant="error">{inviteError}</Alert> : null}

            <form
              id="invite-form"
              className="stack stack--sm"
              onSubmit={handleInvite}
              noValidate
            >
              <TextField
                id="invite-email"
                label="Email address"
                name="invite-email"
                type="email"
                autoComplete="off"
                required
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
              <SelectField
                id="invite-role"
                label="Role"
                name="invite-role"
                options={STAFF_ROLE_OPTIONS}
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
              />
              <div>
                <Button type="submit" loading={inviting}>
                  {inviting ? "Creating invite…" : "Create invitation link"}
                </Button>
              </div>
            </form>

            {issued ? (
              <div className="stack stack--sm">
                <Alert variant="success">
                  Invitation link ready for <strong>{issued.email}</strong> (
                  {roleLabel(issued.role)}). It expires{" "}
                  {formatDateTime(issued.expiresAt)}.
                </Alert>
                <div className="activation-link">
                  <label className="visually-hidden" htmlFor="activation-link">
                    Activation link
                  </label>
                  <input
                    id="activation-link"
                    className="field__input mono"
                    readOnly
                    value={issued.activationLink}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <Button variant="secondary" onClick={handleCopy}>
                    {copied ? "Copied" : "Copy link"}
                  </Button>
                </div>
                <p className="muted">
                  Share this link with the recipient through any channel. It can
                  be used once, and it stops working when accepted, replaced, or
                  expired.
                </p>
                {copyError ? (
                  <Alert variant="warning">{copyError}</Alert>
                ) : null}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Invitations"
            description="The most recent invitations for your school."
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={refreshList}
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
                Loading invitations…
              </p>
            </CardBody>
          ) : invitations.length === 0 ? (
            <CardBody>
              <p className="muted">
                No invitations yet. Create the first one above.
              </p>
            </CardBody>
          ) : (
            <ul className="invitation-list">
              {invitations.map((invitation) => (
                <li className="invitation" key={invitation.invitationId}>
                  <div className="invitation__main">
                    <p className="invitation__email">{invitation.email}</p>
                    <p className="invitation__meta">
                      <InvitationStatusBadge status={invitation.status} />
                      <span>{roleLabel(invitation.role)}</span>
                      <span>{statusDetail(invitation)}</span>
                    </p>
                  </div>
                  {canManageMembers && invitation.status !== "accepted" ? (
                    <div className="invitation__actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReinvite(invitation)}
                      >
                        Re-invite
                      </Button>
                      {invitation.status === "pending" ? (
                        confirmingId === invitation.invitationId ? (
                          <>
                            <Button
                              variant="danger"
                              size="sm"
                              loading={busyId === invitation.invitationId}
                              onClick={() =>
                                handleRevoke(invitation.invitationId)
                              }
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
                            onClick={() =>
                              setConfirmingId(invitation.invitationId)
                            }
                          >
                            Revoke
                          </Button>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
