"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { useRouter } from "next/navigation";

/**
 * School sign-up form.
 *
 * Allows new schools to self-serve sign-up by creating a school account
 * and administrator auth account. On successful submission:
 *   - A school row is created in the database
 *   - An administrator Auth account is created (confirmed, immediate sign-in)
 * - The user is linked to the school as school_administrator
 * - Default grade bands are seeded
 *
 * On success the user is redirected to the sign-in page and can immediately
 * sign in with the provided email and password.
 */
export function SignupForm() {
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    // Validate school code format: 4-10 chars, letters A-H,J-N,P-R,T,Y and digits 0-9
    const SCHOOL_CODE_RE = /^[A-HJ-NP-RT-Y0-9]{4,10}$/;
    if (typeof schoolName !== "string" || schoolName.trim().length < 2) {
      setError("School name must be at least 2 characters.");
      setLoading(false);
      return;
    }
    if (typeof schoolCode !== "string" || !SCHOOL_CODE_RE.test(schoolCode)) {
      setError(
        "School code must be 4–10 characters. Don't use I, O, S or Z — they look like 1, 0, 5 and 2.",
      );
      setLoading(false);
      return;
    }
    if (typeof adminEmail !== "string" || adminEmail.trim().length < 6) {
      setError("Administrator email must be at least 6 characters.");
      setLoading(false);
      return;
    }
    if (typeof adminPassword !== "string" || adminPassword.trim().length < 6) {
      setError("Administrator password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          schoolCode: schoolCode.trim(),
          adminEmail: adminEmail.trim(),
          adminPassword: adminPassword.trim(),
        }),
      });

      const responseJson = (await response.json()) as {
        ok: boolean;
        needsEmailVerification?: boolean;
        error?: string;
        message?: string;
        school?: { code: string; id: string };
      };

      if (!response.ok || !responseJson.ok) {
        const errorMsg = responseJson.error ?? "Sign-up could not be completed.";
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Sign-up successful - redirect to sign-in
      // Email is confirmed, admin can sign in immediately
      const code = responseJson.school?.code;
      if (code) {
        router.replace(`/sign-in?school=${encodeURIComponent(code)}`);
      } else {
        router.replace("/sign-in");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <form
      className="stack stack--sm"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <Alert variant="error" role={null}>
          {error}
        </Alert>
      )}

      <TextField
        label="School name"
        name="schoolName"
        placeholder="e.g. ABC Academy"
        value={schoolName}
        onChange={(e) => setSchoolName(e.target.value)}
        required
      />

      <TextField
        label="School code"
        name="schoolCode"
        placeholder="e.g. ABC1234"
        value={schoolCode}
        onChange={(e) => setSchoolCode(e.target.value)}
        hint="4–10 characters. Don't use I, O, S or Z — they look like 1, 0, 5 and 2."
        required
      />

      <TextField
        label="Administrator email"
        name="adminEmail"
        placeholder="admin@your-school.example"
        value={adminEmail}
        onChange={(e) => setAdminEmail(e.target.value)}
        type="email"
        required
      />

      <TextField
        label="Administrator password"
        name="adminPassword"
        type="password"
        placeholder="e.g. TempPass123!"
        value={adminPassword}
        onChange={(e) => setAdminPassword(e.target.value)}
        hint="Minimum 6 characters"
        required
      />

      <div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating..." : "Create school account"}
        </Button>
      </div>
    </form>
  );
}