"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat";
import {
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Users,
} from "lucide-react";

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
  const pathname = usePathname();
  const active =
    (href: string) =>
      href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === href || pathname.startsWith(href + "/");

  // --- Teacher home view ---

  if (role === "teacher") {
    return (
      <div className="stack">
        <PageHeader
          title={`Welcome back, ${schoolName ?? "your school"}`}
          description="Your dashboard for taking attendance and entering marks."
        />

        {/* Classes grid */}
        {metrics.totalClasses > 0 ? (
          <div className="dashboard-grid">
            <p className="muted">
              Your classes are loading. Please wait…
            </p>
          </div>
        ) : (
          <p className="muted">
            You have no classes assigned yet. Ask the administrator to assign
            classes to you.
          </p>
        )}

        {/* Recent assessments summary */}
        <Card>
          <CardHeader title="Recent assessments" />
          <CardBody>
            <p className="muted">Loading assessment data…</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // --- Administrator home view ---

  const greeting = schoolName
    ? `Welcome back, ${schoolName}${
        metrics.activeTerm ? ` — ${metrics.activeTerm}` : ""
      }`
    : "Welcome back";

  return (
    <div className="stack">
      <PageHeader
        title={greeting}
        description="High-level metrics for your school."
      />

      {/* Getting started checklist */}
      {schoolName && (
        <Card>
          <div className="card__header">
            <div>
              <h2 className="checklist__title">Getting started</h2>
            </div>
          </div>
          <div className="card__body">
            <ol className="checklist">
              <li className={`
                checklist__item${
                  schoolName ? " checklist__item--done" : ""
                }
              `}>
                <span className="checklist__icon">
                  {schoolName ? "✓" : "-"}
                </span>
                <span className="checklist__label">School profile</span>
                <Link
                  href="/dashboard/school"
                  className="checklist__link"
                  aria-current={active("/dashboard/school") ? "page" : undefined}
                >
                  View
                </Link>
              </li>
              <li className={`
                checklist__item${
                  metrics.activeTerm ? " checklist__item--done" : ""
                }
              `}>
                <span className="checklist__icon">
                  {metrics.activeTerm ? "✓" : "-"}
                </span>
                <span className="checklist__label">
                  Academic year and term{" "}
                  {metrics.activeTerm ? `— ${metrics.activeTerm}` : ""}
                </span>
                <Link
                  href="/dashboard/school"
                  className="checklist__link"
                  aria-current={active("/dashboard/school") ? "page" : undefined}
                >
                  View
                </Link>
              </li>
              <li className={`
                checklist__item${
                  metrics.totalClasses > 0 ? " checklist__item--done" : ""
                }
              `}>
                <span className="checklist__icon">
                  {metrics.totalClasses > 0 ? "✓" : "-"}
                </span>
                <span className="checklist__label">
                  Classes {metrics.totalClasses}
                </span>
                <Link
                  href="/dashboard/classes"
                  className="checklist__link"
                  aria-current={active("/dashboard/classes") ? "page" : undefined}
                >
                  View
                </Link>
              </li>
              <li className="checklist__item">
                <span className="checklist__icon">-</span>
                <span className="checklist__label">Subjects</span>
                <Link
                  href="/dashboard/school/assessment"
                  className="checklist__link"
                  aria-current={active("/dashboard/school/assessment") ? "page" : undefined}
                >
                  View
                </Link>
              </li>
              <li className={`
                checklist__item${
                  metrics.totalTeachers > 0 ? " checklist__item--done" : ""
                }
              `}>
                <span className="checklist__icon">
                  {metrics.totalTeachers > 0 ? "✓" : "-"}
                </span>
                <span className="checklist__label">Invite teachers</span>
                <Link
                  href="/dashboard/staff"
                  className="checklist__link"
                  aria-current={active("/dashboard/staff") ? "page" : undefined}
                >
                  View
                </Link>
              </li>
              <li className={`
                checklist__item${
                  metrics.totalStudents > 0 ? " checklist__item--done" : ""
                }
              `}>
                <span className="checklist__icon">
                  {metrics.totalStudents > 0 ? "✓" : "-"}
                </span>
                <span className="checklist__label">Add students</span>
                <Link
                  href="/dashboard/learners"
                  className="checklist__link"
                  aria-current={active("/dashboard/learners") ? "page" : undefined}
                >
                  View
                </Link>
              </li>
            </ol>
          </div>
        </Card>
      )}

      {/* Metrics */}
      <StatGrid>
        <StatCard
          label="Total students"
          value={metrics.totalStudents}
          hint="learners"
          href="/dashboard/learners"
        />
        <StatCard
          label="Total teachers"
          value={metrics.totalTeachers}
          hint="staff"
          href="/dashboard/staff"
        />
        <StatCard
          label="Total classes"
          value={metrics.totalClasses}
          href="/dashboard/classes"
        />
        <StatCard
          label="Active term"
          value={metrics.activeTerm ?? "Not set"}
          href="/dashboard/school"
        />
        <StatCard
          label="Recent activity (7 days)"
          value={metrics.recentActivityCount}
          hint="events"
        />
      </StatGrid>

      {/* Quick actions */}
      <div className="quick-actions">
        <Link
          href="/dashboard/learners"
          className="quick-action"
          aria-current={active("/dashboard/learners") ? "page" : undefined}
        >
          <GraduationCap className="quick-action__icon" />
          <span className="quick-action__label">Add student</span>
        </Link>
        <Link
          href="/dashboard/classes"
          className="quick-action"
          aria-current={active("/dashboard/classes") ? "page" : undefined}
        >
          <BookOpen className="quick-action__icon" />
          <span className="quick-action__label">Create class</span>
        </Link>
        <Link
          href="/dashboard/staff"
          className="quick-action"
          aria-current={active("/dashboard/staff") ? "page" : undefined}
        >
          <Users className="quick-action__icon" />
          <span className="quick-action__label">Invite teacher</span>
        </Link>
      </div>
    </div>
  );
}
