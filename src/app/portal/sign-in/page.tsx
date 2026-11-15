import Link from "next/link";
import { useState } from "react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Student sign-in | School Management Platform",
};

function SignInForm({ onSignIn }: { onSignIn: (schoolCode: string, username: string) => void }) {
  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/portal/sign-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schoolCode: schoolCode.trim(),
          username: username.trim().toLowerCase(),
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "Sign-in failed. Please check your details and try again.");
        return;
      }
      onSignIn(data.portalSchoolCode ?? schoolCode, data.portalUsername ?? username);
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack">
      <h1>Student sign-in</h1>
      <p className="muted">
        Enter your school code and username to sign in to the student portal.
      </p>

      {error && <p className="error mt-2">{error}</p>}

      <form onSubmit={handleSubmit} className="card p-4 mt-4">
        <div className="grid gap-3">
          <div>
            <label className="label">School code</label>
            <input
              type="text"
              name="schoolCode"
              className="input"
              required
              pattern="^[A-HJ-NP-RT-Y0-9]{4,10}$"
              placeholder="e.g. ALPHA"
              value={schoolCode}
              onChange={(e) => setSchoolCode(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              name="username"
              className="input"
              required
              placeholder="e.g. ama.mensah"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
        </div>

        <Button type="submit" disabled={loading} className="btn btn--primary w-100">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="muted mt-3">
        Don't have an account? Ask your teacher or administrator to activate your portal access.
      </p>
    </div>
  );
}

export default function PortalSignInPage() {
  const [schoolCode, setSchoolCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (code: string, name: string) => {
    setSchoolCode(code);
    setUsername(name);
    // In a real app, we'd redirect or show the home page
    window.location.href = "/portal";
  };

  return (
    <div className="stack">
      <h1>Student sign-in</h1>
      <p className="muted">
        Enter your school code and username to sign in to the student portal.
      </p>

      {error && <p className="error mt-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const sc = (e.target as HTMLFormElement).schoolCode.value;
          const un = (e.target as HTMLFormElement).username.value;
          handleSignIn(sc, un);
        }}
      >
        <div className="grid gap-3">
          <div>
            <label className="label">School code</label>
            <input
              type="text"
              name="schoolCode"
              className="input"
              required
              pattern="^[A-HJ-NP-RT-Y0-9]{4,10}$"
              placeholder="e.g. ALPHA"
            />
          </div>
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              name="username"
              className="input"
              required
              placeholder="e.g. ama.mensah"
            />
          </div>
        </div>

        <Button type="submit" className="btn btn--primary w-100">
          Sign in
        </Button>
      </form>

      <p className="muted mt-3">
        Don't have an account? Ask your teacher or administrator to activate your portal access.
      </p>
    </div>
  );
}