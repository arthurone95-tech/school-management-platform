"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { parseStaffSignInInput } from "@/lib/staff/requests";

interface StaffSignInResponse {
  readonly ok?: boolean;
  readonly error?: string;
}

/**
 * Staff sign-in form (D-024).
 *
 * The email and password are validated with the same parser the API uses, then
 * posted to `/api/staff/sign-in`. Failures are shown as one uniform message, so
 * the form cannot be used to discover which accounts exist.
 */
export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = parseStaffSignInInput({ email, password });
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/staff/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.value),
      });
      const payload = (await response
        .json()
        .catch(() => ({}))) as StaffSignInResponse;

      if (!response.ok || payload.ok !== true) {
        setError(payload.error ?? "Sign-in could not be completed. Try again.");
        return;
      }

      router.replace("/dashboard");
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
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
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
