"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

interface PortalSignInResponse {
  readonly ok?: boolean;
  readonly error?: string;
}

/**
 * Student sign-in form (D-020).
 *
 * A student supplies a school code, username and password. The password is
 * required by the API (`src/lib/portal/requests.ts`), so the form collects it;
 * without it the request is always rejected. The same uniform error is shown
 * for every failure so the form cannot be used to discover valid accounts.
 */
export function PortalSignInForm() {
  const router = useRouter();
  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const response = await fetch("/api/portal/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolCode: schoolCode.trim(),
          username: username.trim().toLowerCase(),
          password,
        }),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as PortalSignInResponse;

      if (!response.ok || payload.ok !== true) {
        setError(payload.error ?? "Sign-in could not be completed. Try again.");
        return;
      }

      router.replace("/portal/home");
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
      <h1>Student sign-in</h1>
      <p className="muted">
        Enter your school code, username and password to sign in to the student
        portal.
      </p>

      {error ? <p className="error mt-2">{error}</p> : null}

      <form onSubmit={handleSubmit} className="card p-4 mt-4" noValidate>
        <div className="grid gap-3">
          <div>
            <label className="label" htmlFor="portal-school-code">
              School code
            </label>
            <input
              id="portal-school-code"
              type="text"
              name="schoolCode"
              className="input"
              required
              autoComplete="username"
              placeholder="e.g. ALPHA"
              value={schoolCode}
              onChange={(event) => setSchoolCode(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="portal-username">
              Username
            </label>
            <input
              id="portal-username"
              type="text"
              name="username"
              className="input"
              required
              autoComplete="username"
              placeholder="e.g. ama.mensah"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="portal-password">
              Password
            </label>
            <input
              id="portal-password"
              type="password"
              name="password"
              className="input"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </div>

        <Button type="submit" loading={pending} className="w-100">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="muted mt-3">
        Don’t have an account? Ask your teacher or administrator to activate your
        portal access.
      </p>
    </div>
  );
}
