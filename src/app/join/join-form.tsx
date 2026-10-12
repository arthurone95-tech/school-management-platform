"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Password form for invitation acceptance (D-024).
 *
 * Submits the chosen password to the server, which hands it to Supabase Auth
 * (hashed and stored there; the platform never stores or logs it) and ends the
 * temporary confirmation session. The user then signs in with the new password
 * to activate their membership.
 */
export function JoinForm({ email }: { email: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/staff/set-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => null);

    setSubmitting(false);

    if (response.ok) {
      router.push("/?joined=1");
    } else {
      const message =
        payload && typeof payload.error === "string"
          ? payload.error
          : "The password could not be set. Try again.";
      setError(message);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: "24rem" }}>
      <h1>Choose a password</h1>
      <p>
        Welcome, <strong>{email}</strong>. Choose a password to activate your
        school staff account. You will then sign in with this email and
        password.
      </p>
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
          {submitting ? "Saving…" : "Set password and continue"}
        </button>
        {error ? (
          <p role="alert" style={{ color: "var(--foreground)" }}>
            {error}
          </p>
        ) : null}
      </form>
    </main>
  );
}
