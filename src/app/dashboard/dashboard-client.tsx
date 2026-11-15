"use client";

import Link from "next/link";

import { Card, CardBody, CardHeader } from "@/components/ui/card";

export interface DashboardMetrics {
  readonly totalStudents: number;
  readonly totalTeachers: number;
  readonly totalClasses: number;
  readonly activeTerm: string | null;
  readonly recentActivityCount: number;
}

export function DashboardClient({
  schoolName,
  metrics,
  role,
}: {
  readonly schoolName: string | null;
  readonly metrics: DashboardMetrics;
  readonly role: string | null;
}) {
  // --- Teacher home view ---

  if (role === "teacher") {
    return (
      <div className="stack">
        <div className="stack stack--sm">
          <h1 className="dashboard-greeting">
            Welcome back{" "}
            {schoolName ?? "your school"}{metrics.activeTerm ? ` — ${metrics.activeTerm}` : ""}
          </h1>
          <p className="muted">
            {schoolName ?? "Your school"} — your dashboard for taking attendance
            and entering marks.
          </p>

          {/* Classes grid */}
          {metrics.totalClasses > 0 ? (
            <div className="dashboard-grid">
              {/* Class cards would be rendered here - for now show placeholder */}
              <p className="muted">
                Your classes are loading. Please wait...
              </p>
            </div>
          ) : (
            <p className="muted">
              You have no classes assigned yet. Ask the administrator to assign
              classes to you.
            </p>
          )}

          {/* Recent assessments summary */}
          <div className="card p-4 mb-4">
            <h2 className="text-sm font-medium text-foreground mb-3">
              Recent assessments
            </h2>
            <p className="muted">
              Loading assessment data…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Administrator home view ---
  const greeting = schoolName
    ? `Welcome back, ${schoolName}${metrics.activeTerm ? ` — ${metrics.activeTerm}` : ""}`
    : "Welcome back";

  const cards: ReadonlyArray<{
    readonly label: string;
    readonly value: string | number;
    readonly href?: string;
  }> = [
    { label: "Total students", value: metrics.totalStudents, href: "/dashboard/learners" },
    { label: "Total teachers", value: metrics.totalTeachers, href: "/dashboard/staff" },
    { label: "Total classes", value: metrics.totalClasses, href: "/dashboard/classes" },
    { label: "Active term", value: metrics.activeTerm ?? "Not set", href: "/dashboard/school" },
    { label: "Recent activity (7 days)", value: metrics.recentActivityCount },
  ];

  return (
    <div className="stack">
      <div className="stack stack--sm">
        <h1 className="dashboard-greeting">{greeting}</h1>

        <p className="muted">
          {schoolName ?? "Your school"} — high-level metrics for your school.
        </p>

        {/* Getting started checklist */}
        {schoolName && (
          <div className="dashboard-checklist">
            <h2 className="dashboard-checklist-title">Getting started</h2>
            <ol className="dashboard-checklist-list">
              <li className={`
                dashboard-checklist-item${schoolName ? " dashboard-checklist-item--done" : ""}
              `}>
                <span className="dashboard-checklist-icon">
                  {schoolName ? "✓" : ""}
                </span>
                <span className="dashboard-checklist-label">School profile</span>
                <Link
                  href="/dashboard/school"
                  className="dashboard-checklist-link">
                  View
                </Link>
              </li>
              <li className={`
                dashboard-checklist-item${metrics.activeTerm ? " dashboard-checklist-item--done" : ""}
              `}>
                <span className="dashboard-checklist-icon">
                  {metrics.activeTerm ? "✓" : ""}
                </span>
                <span className="dashboard-checklist-label">
                  Academic year and term{" "}
                  {metrics.activeTerm ? `— ${metrics.activeTerm}` : ""}
                </span>
                <Link
                  href="/dashboard/school"
                  className="dashboard-checklist-link">
                  View
                </Link>
              </li>
              <li className={`
                dashboard-checklist-item${metrics.totalClasses > 0 ? " dashboard-checklist-item--done" : ""}
              `}>
                <span className="dashboard-checklist-icon">
                  {metrics.totalClasses > 0 ? "✓" : ""}
                </span>
                <span className="dashboard-checklist-label">
                  Classes{` `}{metrics.totalClasses}
                </span>
                <Link
                  href="/dashboard/classes"
                  className="dashboard-checklist-link">
                  View
                </Link>
              </li>
              <li className="dashboard-checklist-item">
                <span className="dashboard-checklist-icon">
                  -
                </span>
                <span className="dashboard-checklist-label">
                  Subjects
                  <span className="dashboard-checklist-note">
                    Coming soon
                  </span>
                </span>
                <Link
                  href="/dashboard/school"
                  className="dashboard-checklist-link">
                  View
                </Link>
              </li>
              <li className={`
                dashboard-checklist-item${metrics.totalTeachers > 0 ? " dashboard-checklist-item--done" : ""}
              `}>
                <span className="dashboard-checklist-icon">
                  {metrics.totalTeachers > 0 ? "✓" : ""}
                </span>
                <span className="dashboard-checklist-label">
                  Invite teachers
                </span>
                <Link
                  href="/dashboard/staff"
                  className="dashboard-checklist-link">
                  View
                </Link>
              </li>
              <li className={`
                dashboard-checklist-item${metrics.totalStudents > 0 ? " dashboard-checklist-item--done" : ""}
              `}>
                <span className="dashboard-checklist-icon">
                  {metrics.totalStudents > 0 ? "✓" : ""}
                </span>
                <span className="dashboard-checklist-label">
                  Add students
                </span>
                <Link
                  href="/dashboard/learners"
                  className="dashboard-checklist-link">
                  View
                </Link>
              </li>
            </ol>
          </div>
        )}

        <div className="dashboard-grid">
          {cards.map((card) => {
            const inner = (
              <Card>
                <CardHeader title={card.label} />
                <CardBody>
                  <p className="dashboard-card-value">{card.value}</p>
                </CardBody>
              </Card>
            );
            return card.href ? (
              <Link key={card.label} href={card.href} className="dashboard-card-link">
                {inner}
              </Link>
            ) : (
              <div key={card.label}>{inner}</div>
            );
          })}
        </div>
        {/* Quick actions */}
        <div className="dashboard-quick-actions">
          <Link
            href="/dashboard/learners/new"
            className="dashboard-quick-action-btn btn btn--secondary"
          >
            Add student
          </Link>
          <Link
            href="/dashboard/classes/new"
            className="dashboard-quick-action-btn btn btn--secondary"
          >
            Create class
          </Link>
          <Link
            href="/dashboard/staff/invite"
            className="dashboard-quick-action-btn btn btn--secondary"
          >
            Invite teacher
          </Link>
        </div>
      </div>
    </div>
  );
}