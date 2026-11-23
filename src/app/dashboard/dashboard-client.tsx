"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat";
import type { DashboardOverview } from "@/lib/staff/dashboard-overview";
import { BookOpen, GraduationCap, Users } from "lucide-react";

export interface DashboardMetrics {
  readonly totalStudents: number;
  readonly totalTeachers: number;
  readonly totalClasses: number;
  readonly activeTerm: string | null;
  readonly recentActivityCount: number;
}

const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  GENERAL: "General",
  HOLIDAY: "Holiday",
  EXAM: "Examination",
  MEETING: "Meeting",
  SPORTS: "Sports",
  CULTURAL: "Cultural",
  OTHER: "Other",
};

function dateRange(startsOn: string, endsOn: string): string {
  return startsOn === endsOn ? startsOn : `${startsOn} → ${endsOn}`;
}

function OverviewList({
  entries,
  emptyMessage,
}: {
  readonly entries: readonly {
    readonly id: string;
    readonly title: string;
    readonly meta: string;
  }[];
  readonly emptyMessage: string;
}) {
  if (entries.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }
  return (
    <ul className="record-list">
      {entries.map((entry) => (
        <li key={entry.id} className="record">
          <div className="record__main">
            <span className="record__title">{entry.title}</span>
            <div className="record__meta">{entry.meta}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardClient({
  schoolName,
  metrics,
  overview,
}: {
  readonly schoolName: string | null;
  readonly metrics: DashboardMetrics;
  readonly overview: DashboardOverview;
}) {
  const pathname = usePathname();
  const active =
    (href: string) =>
      href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname === href || pathname.startsWith(href + "/");

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

      {/* School overview */}
      {overview.incomplete ? (
        <Alert variant="error" role={null}>
          Some school overview figures could not be loaded. Refresh the page to
          try again.
        </Alert>
      ) : null}

      <div className="dashboard-grid">
        <Card>
          <CardHeader title="Student profile" />
          <CardBody>
            <ul className="record-list">
              <li className="record">
                <div className="record__main">
                  <span className="record__title">Male students</span>
                </div>
                <div className="record__actions">
                  <Badge variant="info">{overview.maleLearners}</Badge>
                </div>
              </li>
              <li className="record">
                <div className="record__main">
                  <span className="record__title">Female students</span>
                </div>
                <div className="record__actions">
                  <Badge variant="info">{overview.femaleLearners}</Badge>
                </div>
              </li>
              <li className="record">
                <div className="record__main">
                  <span className="record__title">Other</span>
                </div>
                <div className="record__actions">
                  <Badge variant="neutral">{overview.otherLearners}</Badge>
                </div>
              </li>
              <li className="record">
                <div className="record__main">
                  <span className="record__title">Active students</span>
                </div>
                <div className="record__actions">
                  <Badge variant="success">{overview.activeLearners}</Badge>
                </div>
              </li>
              <li className="record">
                <div className="record__main">
                  <span className="record__title">Inactive students</span>
                </div>
                <div className="record__actions">
                  <Badge variant="inactive">{overview.inactiveLearners}</Badge>
                </div>
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Enrolment by class" />
          <CardBody>
            <OverviewList
              entries={overview.enrolmentByClass.map((klass) => ({
                id: klass.classId,
                title: klass.className,
                meta: `${klass.count} students`,
              }))}
              emptyMessage="No classes have been added yet."
            />
          </CardBody>
        </Card>
      </div>

      <div className="dashboard-grid">
        <Card>
          <CardHeader title="Upcoming events" />
          <CardBody>
            <OverviewList
              entries={overview.upcomingEvents.map((event) => ({
                id: event.id,
                title: event.title,
                meta: `${EVENT_TYPE_LABELS[event.eventType] ?? event.eventType} · ${dateRange(event.startsOn, event.endsOn)}`,
              }))}
              emptyMessage="No upcoming events."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Upcoming examinations" />
          <CardBody>
            <OverviewList
              entries={overview.upcomingExams.map((exam) => ({
                id: exam.id,
                title: exam.name,
                meta: `${dateRange(exam.startsOn, exam.endsOn)} · ${exam.status}`,
              }))}
              emptyMessage="No upcoming examinations."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Upcoming assessments" />
          <CardBody>
            <OverviewList
              entries={overview.upcomingAssessments.map((assessment) => ({
                id: assessment.id,
                title: assessment.name,
                meta: `${assessment.className || "Whole school"} · ${assessment.assessedOn}`,
              }))}
              emptyMessage="No upcoming assessments."
            />
          </CardBody>
        </Card>
      </div>

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
