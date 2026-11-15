import Link from "next/link";
import { useState, useEffect } from "react";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Student activation | School Management Platform",
};

function ActivateForm({ onActivate }: { onActivate: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/portal/activate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code.trim(),
          newPassword,
          confirmPassword,
        }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.error || "Activation failed. The code may be expired or invalid.");
        return;
      }
      onActivate(data.code ?? code);
    } catch (_err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1>Student activation</h1>
      <p className="muted">
        Enter your one-time activation code and choose a new password.
      </p>

      {error && <p className="error mt-2">{error}</p>}

      <form onSubmit={handleSubmit} className="card p-4 mt-4">
        <div className="grid gap-3">
          <div>
            <label className="label">Activation code</label>
            <input
              type="text"
              name="code"
              className="input"
              required
              placeholder="e.g. ACT-12345-ABCDE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              name="newPassword"
              className="input"
              required
              minLength={8}
              placeholder="minimum 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              name="confirmPassword"
              className="input"
              required
              minLength={8}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          />
        </div>

        <Button type="submit" disabled={loading} className="btn btn--primary w-100">
          {loading ? "Activating…" : "Activate"}
        </Button>
      </form>

      <p className="muted mt-3">
        Activate your account to start using the student portal.
      </p>
    </>
  );
}

export default function PortalActivatePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleActivate = async (code: string) => {
    setCode(code);
    // In a real app, we'd redirect or show the home page
    window.location.href = "/portal";
  };

  return (
    <div className="stack">
      <h1>Student activation</h1>
      <p className="muted">
        Enter your one-time activation code and choose a new password.
      </p>

      {error && <p className="error mt-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const c = (e.target as HTMLFormElement).code.value;
          handleActivate(c);
        }}
      >
        <div className="grid gap-3">
          <div>
            <label className="label">Activation code</label>
            <input
              type="text"
              name="code"
              className="input"
              required
              placeholder="e.g. ACT-12345-ABCDE"
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              name="newPassword"
              className="input"
              required
              minLength={8}
              placeholder="minimum 8 characters"
            />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              name="confirmPassword"
              className="input"
              required
              minLength={8}
              placeholder="Confirm password"
            />
          />
        </div>

        <Button type="submit" className="btn btn--primary w-100">
          Activate
        </Button>
      </form>

      <p className="muted mt-3">
        If you do not have an activation code, ask your teacher or administrator
        to issue one.
      </p>
    </div>
  );
}