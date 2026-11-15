"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";

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
    <form className="stack stack--sm" onSubmit={handleSubmit} noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}

      <TextField
        label="Activation code"
        name="code"
        placeholder="e.g. ACT-12345-ABCDE"
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />

      <TextField
        label="New password"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        hint="At least 8 characters."
        required
        value={newPassword}
        onChange={(event) => setNewPassword(event.target.value)}
      />

      <TextField
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />

      <div>
        <Button type="submit" loading={pending}>
          {pending ? "Activating…" : "Activate"}
        </Button>
      </div>
    </form>
  );
}
