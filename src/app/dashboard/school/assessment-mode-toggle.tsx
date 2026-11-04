"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { GesFrameworkReference } from "@/components/assessment/ges-framework-reference";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

type Mode = "ges_standard" | "custom";

export function AssessmentModeToggle({
  canConfigure = false,
  canManage = true,
}: {
  readonly canConfigure?: boolean;
  readonly canManage?: boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/staff/school/assessment-mode", {
          headers: { Accept: "application/json" },
        });
        const payload = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          mode?: Mode;
          error?: string;
        };
        if (!cancelled) {
          if (
            payload.ok &&
            (payload.mode === "ges_standard" || payload.mode === "custom")
          ) {
            setMode(payload.mode);
          } else {
            setError(
              payload.error ?? "The assessment mode could not be loaded.",
            );
          }
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("The assessment mode could not be loaded.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function switchMode(next: Mode) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/school/assessment-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        mode?: Mode;
        error?: string;
      };
      if (res.ok && payload.ok && payload.mode) {
        setMode(payload.mode);
      } else {
        setError(payload.error ?? "The assessment mode could not be saved.");
      }
    } catch {
      setError("The assessment mode could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Assessment & grading framework"
        description="Choose how this school records assessments and grades. The two modes are mutually exclusive."
      />
      <CardBody className="stack stack--sm">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {loading ? (
          <p className="muted" role="status">
            Loading…
          </p>
        ) : (
          <>
            <div className="cluster">
              <Button
                variant={mode === "ges_standard" ? "primary" : "secondary"}
                size="sm"
                disabled={saving || !canManage}
                aria-pressed={mode === "ges_standard"}
                onClick={() => void switchMode("ges_standard")}
              >
                GES / NaCCA standard
              </Button>
              <Button
                variant={mode === "custom" ? "primary" : "secondary"}
                size="sm"
                disabled={saving || !canManage}
                aria-pressed={mode === "custom"}
                onClick={() => void switchMode("custom")}
              >
                Fully custom
              </Button>
            </div>

            {!canManage ? (
              <p className="muted" style={{ margin: 0 }}>
                Only a school administrator can change the assessment
                framework.
              </p>
            ) : null}

            <p className="muted" style={{ margin: 0 }}>
              {mode === "ges_standard"
                ? "Read-only GES preset: standard class hierarchy, NaCCA subjects, 50/50 class-exam split, A1–F9 scale and proficiency descriptors."
                : "Custom mode: your school defines its own subjects, grade boundaries and report card layout."}
            </p>

            {mode === "ges_standard" ? <GesFrameworkReference /> : null}

            {mode === "custom" && canConfigure ? (
              <div className="cluster cluster--end">
                <Link
                  className="btn btn--secondary btn--sm"
                  href="/dashboard/school/assessment"
                >
                  Manage custom framework
                </Link>
              </div>
            ) : null}
          </>
        )}
      </CardBody>
    </Card>
  );
}
