"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";

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
    <form className="stack stack--sm" onSubmit={handleSubmit} noValidate>
      {error ? <Alert variant="error">{error}</Alert> : null}

      <TextField
        label="School code"
        name="schoolCode"
        autoComplete="username"
        placeholder="e.g. ALPHA"
        required
        value={schoolCode}
        onChange={(event) => setSchoolCode(event.target.value)}
      />

      <TextField
        label="Username"
        name="username"
        autoComplete="username"
        placeholder="e.g. ama.mensah"
        required
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <div>
        <Button type="submit" loading={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </form>
  );
}
