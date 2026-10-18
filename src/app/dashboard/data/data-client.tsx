"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/form";
import {
  IMPORT_TEMPLATE_EXAMPLE,
  IMPORT_TEMPLATE_HEADER,
} from "@/lib/dataexchange/learner-import";
import { utcToday } from "@/lib/dates";
import type { AttendanceClassOption } from "@/lib/attendance/types";
import { roleLabel } from "@/lib/staff/roles";

/**
 * Import and export (D-032).
 *
 * **Export** downloads a CSV. The file is produced by the server on the caller's
 * session client and is recorded in the audit trail by the database, so an export
 * of children's data is visible to whoever reviews the audit log.
 *
 * **Import** reads a CSV in the browser and posts the text to the server, which
 * validates every row with the same parser the single-student form uses. The
 * response lists each row with its line number and whether it was created, so the
 * user fixes the specific lines that failed rather than starting again.
 *
 * The file is read in the browser rather than uploaded elsewhere, and is never
 * sent anywhere but this application's own server.
 */

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

interface RowOutcome {
  readonly row: number;
  readonly registrationNumber: string | null;
  readonly created: boolean;
  readonly message: string | null;
}

interface ImportSummary {
  readonly created: number;
  readonly completedPlacement: number;
  readonly failed: number;
  readonly results: readonly RowOutcome[];
  readonly issues: readonly {
    row: number;
    registrationNumber: string | null;
    message: string;
  }[];
  readonly ignoredColumns: readonly string[];
}

export function DataClient({
  email,
  role,
  schoolName,
  canImport,
  canExportLearners,
  canExportReports,
}: {
  readonly email: string;
  readonly role: string;
  readonly schoolName: string | null;
  readonly canImport: boolean;
  readonly canExportLearners: boolean;
  readonly canExportReports: boolean;
}) {
  const router = useRouter();
  const today = utcToday();

  const [classes, setClasses] = useState<AttendanceClassOption[]>([]);
  const [classId, setClassId] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!canExportReports) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/staff/attendance/options", {
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json().catch(() => ({}))) as {
          classes?: AttendanceClassOption[];
        };
        if (!cancelled && Array.isArray(payload.classes)) {
          setClasses(payload.classes);
        }
      } catch {
        // An empty picker is a safe fallback; the export will explain itself.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canExportReports]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/staff/sign-out", { method: "POST" });
    } catch {
      // Best effort; the redirect below still applies.
    }
    router.replace("/sign-in");
    router.refresh();
  }

  async function download(url: string, label: string) {
    setError(null);
    setNotice(null);
    setExporting(label);
    try {
      const response = await fetch(url, { headers: { Accept: "text/csv" } });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error ?? "The export could not be produced.");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const url2 = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url2;
      link.download = match?.[1] ?? "export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url2);

      const rows = response.headers.get("X-Row-Count");
      setNotice(
        rows
          ? `Exported ${rows} row${rows === "1" ? "" : "s"}. This export is recorded in the audit trail.`
          : "Export downloaded. It is recorded in the audit trail.",
      );
    } catch {
      setError(NETWORK_MESSAGE);
    } finally {
      setExporting(null);
    }
  }

  async function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setNotice(null);
    setSummary(null);

    const file = event.target.files?.[0];
    if (!file) {
      setFileText(null);
      setFileName(null);
      return;
    }
    setFileName(file.name);

    try {
      const text = await file.text();
      setFileText(text);
    } catch {
      setFileText(null);
      setError("That file could not be read.");
    }
  }

  async function runImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fileText === null) {
      setError("Choose a CSV file first.");
      return;
    }

    setError(null);
    setNotice(null);
    setSummary(null);
    setImporting(true);

    try {
      const response = await fetch("/api/staff/import/learners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: fileText }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      } & Partial<ImportSummary>;

      if (!response.ok || payload.ok !== true) {
        setError(payload.error ?? "The import could not be run.");
        return;
      }

      setSummary(payload as unknown as ImportSummary);
      setNotice(
        `Imported ${payload.created ?? 0} learner${payload.created === 1 ? "" : "s"}.` +
          (payload.failed
            ? ` ${payload.failed} row${payload.failed === 1 ? "" : "s"} need attention below.`
            : ""),
      );
    } catch {
      setError(NETWORK_MESSAGE);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="brand">
            <span className="brand__name">{schoolName ?? "Your school"}</span>
            <span className="brand__context">
              {roleLabel(role)}
              {email ? ` · ${email}` : ""}
            </span>
          </div>
          <div className="cluster cluster--end">
            <Link className="btn btn--secondary btn--sm" href="/dashboard">
              Dashboard
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleSignOut()}
              loading={signingOut}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container stack">
        <div className="stack stack--sm">
          <h1>Import and export</h1>
          <p className="muted">
            Bring in a class list you already hold, or take a copy of your data
            out. Exports include children&rsquo;s personal data and are recorded
            in the audit trail.
          </p>
        </div>

        {error ? <Alert variant="error">{error}</Alert> : null}
        {notice ? <Alert variant="success">{notice}</Alert> : null}

        {canExportLearners || canExportReports ? (
          <Card>
            <CardHeader
              title="Export"
              description="Downloads a CSV. Every export is recorded with your name against the school's audit trail."
            />
            <CardBody className="stack">
              {canExportLearners ? (
                <div className="form-grid__actions">
                  <Button
                    variant="secondary"
                    loading={exporting === "learners"}
                    onClick={() =>
                      void download(
                        "/api/staff/export?kind=learners",
                        "learners",
                      )
                    }
                  >
                    {exporting === "learners"
                      ? "Preparing…"
                      : "All learners (CSV)"}
                  </Button>
                </div>
              ) : null}

              {canExportReports ? (
                <>
                  <div className="form-grid">
                    <SelectField
                      label="Class"
                      value={classId}
                      onChange={(event) => setClassId(event.target.value)}
                      options={[
                        { value: "", label: "Choose a class" },
                        ...classes.map((klass) => ({
                          value: klass.id,
                          label: klass.name,
                        })),
                      ]}
                    />
                    <div className="field">
                      <label className="field__label" htmlFor="export-from">
                        From
                      </label>
                      <input
                        id="export-from"
                        className="field__input"
                        type="date"
                        max={today}
                        value={from}
                        onChange={(event) => setFrom(event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="export-to">
                        To
                      </label>
                      <input
                        id="export-to"
                        className="field__input"
                        type="date"
                        max={today}
                        value={to}
                        onChange={(event) => setTo(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-grid__actions">
                    <Button
                      variant="secondary"
                      disabled={!classId}
                      loading={exporting === "attendance"}
                      onClick={() =>
                        void download(
                          `/api/staff/export?kind=attendance&classId=${encodeURIComponent(
                            classId,
                          )}&from=${from}&to=${to}`,
                          "attendance",
                        )
                      }
                    >
                      {exporting === "attendance"
                        ? "Preparing…"
                        : "Class attendance (CSV)"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={!classId}
                      loading={exporting === "results"}
                      onClick={() =>
                        void download(
                          `/api/staff/export?kind=results&classId=${encodeURIComponent(
                            classId,
                          )}&from=${from}&to=${to}`,
                          "results",
                        )
                      }
                    >
                      {exporting === "results"
                        ? "Preparing…"
                        : "Class results (CSV)"}
                    </Button>
                  </div>
                </>
              ) : null}
            </CardBody>
          </Card>
        ) : null}

        {canImport ? (
          <Card>
            <CardHeader
              title="Import a class list"
              description="Upload a CSV of learners you already have. Each row is checked against the same rules as the single-student form."
            />
            <CardBody className="stack">
              <Alert variant="info">
                The header row must be exactly{" "}
                <span className="mono">{IMPORT_TEMPLATE_HEADER.join(",")}</span>
                . If a value contains a comma, wrap it in double quotes. Class
                names must already exist in your school. Import at most 100
                usable rows at a time.
              </Alert>

              <p className="muted mono">{IMPORT_TEMPLATE_EXAMPLE.join(",")}</p>

              <form className="stack" onSubmit={runImport}>
                <div className="field">
                  <label className="field__label" htmlFor="import-file">
                    CSV file
                  </label>
                  <input
                    id="import-file"
                    className="field__input"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(event) => void onFileChosen(event)}
                  />
                  {fileName ? (
                    <p className="field__hint">Selected: {fileName}</p>
                  ) : null}
                </div>
                <div className="form-grid__actions">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={importing}
                    disabled={fileText === null}
                  >
                    {importing ? "Importing…" : "Import learners"}
                  </Button>
                </div>
              </form>

              {summary ? (
                <div className="stack">
                  {summary.ignoredColumns.length > 0 ? (
                    <Alert variant="warning">
                      These columns were ignored:{" "}
                      {summary.ignoredColumns.join(", ")}.
                    </Alert>
                  ) : null}

                  {summary.completedPlacement > 0 ? (
                    <Alert variant="info">
                      {summary.completedPlacement} existing learner
                      {summary.completedPlacement === 1
                        ? " was"
                        : "s were"}{" "}
                      placed in a class they had none of.
                    </Alert>
                  ) : null}

                  {summary.issues.length > 0 ? (
                    <div className="stack stack--sm">
                      <h2 className="card__title">Rows to fix</h2>
                      <ul className="record-list">
                        {summary.issues.map((issue) => (
                          <li key={`issue-${issue.row}`} className="record">
                            <div className="record__main">
                              <p className="record__title">
                                Line {issue.row}
                                {issue.registrationNumber
                                  ? ` — ${issue.registrationNumber}`
                                  : ""}
                              </p>
                              <p className="record__meta">{issue.message}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {summary.results.filter((entry) => !entry.created).length >
                  0 ? (
                    <div className="stack stack--sm">
                      <h2 className="card__title">Rows the database refused</h2>
                      <ul className="record-list">
                        {summary.results
                          .filter((entry) => !entry.created)
                          .map((entry) => (
                            <li key={`row-${entry.row}`} className="record">
                              <div className="record__main">
                                <p className="record__title">
                                  Line {entry.row}
                                  {entry.registrationNumber
                                    ? ` — ${entry.registrationNumber}`
                                    : ""}
                                </p>
                                <p className="record__meta">{entry.message}</p>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
