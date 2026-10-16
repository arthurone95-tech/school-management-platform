"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { parseInvitationTokenFragment } from "@/lib/staff/invitations";

interface InvitationPreview {
  readonly email: string;
  readonly role: string;
  readonly expiresAt: string;
  readonly schoolName: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  school_administrator: "School administrator",
  teacher: "Teacher",
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** The URL fragment as an external store, so it is read without an effect. */
function subscribeToFragment(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readFragment(): string {
  return window.location.hash;
}

/** `undefined` marks the pre-hydration render, when the fragment is unknown. */
function readServerFragment(): string | undefined {
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Acceptance form for a shareable staff invitation (D-025).
 *
 * The token is read from the URL fragment (`#token=<hex>`), verified against
 * `/api/staff/invitations/preview`, then submitted with the chosen password to
 * `/api/staff/invitations/accept`. The credential is never written back into
 * the address bar by this app and is removed from browser history on success.
 * Only a hash of the token is stored server-side; it is never logged.
 */
export function JoinForm() {
  const fragment = useSyncExternalStore(
    subscribeToFragment,
    readFragment,
    readServerFragment,
  );
  const token =
    fragment === undefined ? null : parseInvitationTokenFragment(fragment);

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/staff/invitations/preview", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = asRecord(await response.json().catch(() => null));
        if (cancelled) {
          return;
        }
        if (response.ok && payload?.ok === true) {
          setPreview({
            email: String(payload.email ?? ""),
            role: String(payload.role ?? ""),
            expiresAt: String(payload.expiresAt ?? ""),
            schoolName:
              typeof payload.schoolName === "string"
                ? payload.schoolName
                : null,
          });
          return;
        }
        if (typeof payload?.error === "string") {
          setInvalidMessage(payload.error);
        }
      } catch {
        if (!cancelled) {
          setInvalidMessage(
            "We could not reach the server. Check your connection and try again.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/staff/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = asRecord(await response.json().catch(() => null));

      if (response.ok && payload?.ok === true) {
        // Drop the credential from the address bar and history.
        window.history.replaceState(null, "", window.location.pathname);
        setPassword("");
        setAccepted(true);
        return;
      }

      setError(
        typeof payload?.error === "string"
          ? payload.error
          : "The password could not be set. Try again.",
      );
    } catch {
      setError(
        "We could not reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const checking =
    accepted === false &&
    (fragment === undefined ||
      (token !== null && preview === null && invalidMessage === null));

  return (
    <main style={{ padding: "2rem", maxWidth: "26rem" }}>
      <h1>Accept your invitation</h1>

      {checking ? <p>Checking your invitation link…</p> : null}

      {accepted ? (
        <div>
          <p role="status">
            Your account is ready. Sign in with your email address and new
            password.
          </p>
          <Link href="/">Go to sign in</Link>
        </div>
      ) : null}

      {!accepted && !checking && preview === null ? (
        <div>
          <p role="alert">
            {invalidMessage ??
              "That invitation link is not valid, has expired, or has already been used."}
          </p>
          <p>
            Ask your school administrator for a new invitation link, then open
            it again.
          </p>
        </div>
      ) : null}

      {!accepted && preview ? (
        <div>
          <p>
            {preview.schoolName ? (
              <>
                <strong>{preview.schoolName}</strong> has invited you to join
                as{" "}
              </>
            ) : (
              <>You have been invited to join as </>
            )}
            <strong>{roleLabel(preview.role)}</strong>.
          </p>
          <p>
            Set a password for <strong>{preview.email}</strong>. You will sign
            in with this email and password.
          </p>
          {preview.expiresAt ? (
            <p>
              This invitation expires on{" "}
              {new Date(preview.expiresAt).toLocaleString()}.
            </p>
          ) : null}
          <form
            onSubmit={onSubmit}
            style={{ display: "grid", gap: "0.75rem", marginTop: "1rem" }}
          >
            <label htmlFor="password">Password (8–72 characters)</label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Set password and activate account"}
            </button>
            {error ? (
              <p role="alert" style={{ color: "var(--foreground)" }}>
                {error}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </main>
  );
}
