"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

interface PortalActivateResponse {
  readonly ok?: boolean;
  readonly error?: string;
}

/**
 * Student activation form (D-019, D-020).
 *
 * The student presents the one-time code their school issued and chooses a
 * password. The two passwords are compared before the request is sent so the
 * user gets immediate feedback; the server repeats the check and claims the
 * code atomically. On success the student is sent to sign in with the new
 * password.
 */
export function ActivateForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/portal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as PortalActivateResponse;

      if (!response.ok || payload.ok !== true) {
        setError(payload.error ?? "Activation could not be completed. Try again.");
        return;
      }

      router.replace("/portal/sign-in");
      router.refresh();
    } catch {
      setError(
        "Could not reach the server. Check your connection and try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <h1>Student activation</h1>
      <p className="muted">
        Enter your one-time activation code and choose a new password.
      </p>

      {error ? <p className="error mt-2">{error}</p> : null}

      <form onSubmit={handleSubmit} className="card p-4 mt-4" noValidate>
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="activation-code">
              Activation code
            </label>
            <input
              id="activation-code"
              type="text"
              name="code"
              className="input"
              required
              placeholder="e.g. ACT-12345-ABCDE"
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="activation-new-password">
              New password
            </label>
            <input
              id="activation-new-password"
              type="password"
              name="newPassword"
              className="input"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="minimum 8 characters"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="activation-confirm-password">
              Confirm password
            </label>
            <input
              id="activation-confirm-password"
              type="password"
              name="confirmPassword"
              className="input"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
        </div>

        <Button type="submit" loading={pending} className="w-100">
          {pending ? "Activating…" : "Activate"}
        </Button>
      </form>

      <p className="muted mt-3">
        If you do not have an activation code, ask your teacher or administrator
        to issue one.
      </p>
    </div>
  );
}
