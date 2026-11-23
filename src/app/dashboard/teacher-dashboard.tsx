import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat";
import {
  BookOpen,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
} from "lucide-react";

export interface TeacherClassSummary {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface TeacherSubjectSummary {
  readonly id: string;
  readonly name: string;
  readonly code: string | null;
}

export interface TeacherAssessmentSummary {
  readonly id: string;
  readonly name: string;
  readonly className: string;
  readonly subjectName: string | null;
  readonly assessedOn: string;
  readonly markedCount: number;
  readonly learnerCount: number;
  readonly pendingCount: number;
  readonly isActive: boolean;
}

export interface TeacherSessionSummary {
  readonly id: string;
  readonly className: string;
  readonly subjectName: string | null;
  readonly sessionDate: string;
  readonly recordedCount: number;
  readonly isCorrectable: boolean;
}

export interface TeacherDashboardData {
  readonly classes: readonly TeacherClassSummary[];
  readonly subjects: readonly TeacherSubjectSummary[];
  readonly assessments: readonly TeacherAssessmentSummary[];
  readonly sessions: readonly TeacherSessionSummary[];
  readonly assessmentMode: "custom" | "ges_standard" | null;
  readonly activeTerm: string | null;
  readonly loadError: string | null;
}

/**
 * Teacher home screen.
 *
 * Every figure comes from helpers that run on the signed-in teacher's own
 * session: classes and subjects through the gated `accessible_classes` and
 * `class_subjects` functions, assessments through `can_access_class`, and
 * registers through the attendance session policy. A teacher never receives a
 * school-wide figure here, and no learner personal data is shown.
 */
export function TeacherDashboard({
  schoolName,
  data,
}: {
  readonly schoolName: string | null;
  readonly data: TeacherDashboardData;
}) {
  const isGes = data.assessmentMode === "ges_standard";
  const pendingMarks = data.assessments.reduce(
    (total, assessment) => total + assessment.pendingCount,
    0,
  );
  const description = data.activeTerm
    ? `Your classes, assessments and attendance — ${data.activeTerm}.`
    : "Your classes, assessments and attendance for today.";

  return (
    <div className="stack">
      <PageHeader
        title={`Welcome back, ${schoolName ?? "your school"}`}
        description={description}
      />

      {data.loadError ? (
        <Alert variant="error" role={null}>
          Some dashboard information could not be loaded. Refresh the page to try
          again.
        </Alert>
      ) : null}

      <StatGrid>
        <StatCard
          label="My classes"
          value={data.classes.length}
          href="/dashboard/attendance"
        />
        <StatCard label="My subjects" value={data.subjects.length} />
        <StatCard
          label="Marks to enter"
          value={isGes ? "GES" : pendingMarks}
          hint={isGes ? "use the GES score sheet" : "across recent assessments"}
          href="/dashboard/results"
        />
        <StatCard
          label="Registers today"
          value={data.sessions.length}
          hint="recorded"
          href="/dashboard/attendance"
        />
      </StatGrid>

      <div className="dashboard-grid">
        <Card>
          <CardHeader title="My classes" />
          <CardBody>
            {data.classes.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={20} />}
                title="No classes assigned"
                description="Ask your administrator to assign a class to you."
              />
            ) : (
              <ul className="record-list">
                {data.classes.map((klass) => (
                  <li key={klass.id} className="record">
                    <div className="record__main">
                      <span className="record__title">{klass.name}</span>
                      <div className="record__meta">
                        <Badge variant={klass.isActive ? "active" : "inactive"}>
                          {klass.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="My subjects" />
          <CardBody>
            {data.subjects.length === 0 ? (
              <EmptyState
                icon={<GraduationCap size={20} />}
                title="No subjects assigned"
                description="Ask your administrator to assign a subject to you."
              />
            ) : (
              <ul className="record-list">
                {data.subjects.map((subject) => (
                  <li key={subject.id} className="record">
                    <div className="record__main">
                      <span className="record__title">{subject.name}</span>
                      {subject.code ? (
                        <div className="record__meta">{subject.code}</div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent assessments"
          description="Marks you are responsible for in your assigned classes."
        />
        <CardBody>
          {isGes ? (
            <EmptyState
              icon={<ClipboardList size={20} />}
              title="Your school uses the GES framework"
              description="Open the GES score sheet to enter and review marks for your classes."
              actions={
                <Link className="btn btn--secondary btn--sm" href="/dashboard/results">
                  Open score sheet
                </Link>
              }
            />
          ) : data.assessments.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={20} />}
              title="No recent assessments"
              description="When assessments are created for your classes, they will appear here."
              actions={
                <Link className="btn btn--secondary btn--sm" href="/dashboard/results">
                  View assessments
                </Link>
              }
            />
          ) : (
            <ul className="record-list">
              {data.assessments.map((assessment) => (
                <li key={assessment.id} className="record">
                  <div className="record__main">
                    <span className="record__title">{assessment.name}</span>
                    <div className="record__meta">
                      <span>{assessment.className}</span>
                      {assessment.subjectName ? (
                        <span>· {assessment.subjectName}</span>
                      ) : null}
                      <span>· {assessment.assessedOn}</span>
                    </div>
                  </div>
                  <div className="record__actions">
                    <Badge
                      variant={
                        assessment.pendingCount === 0 ? "success" : "warning"
                      }
                    >
                      {assessment.markedCount}/{assessment.learnerCount} marked
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Today's registers" />
        <CardBody>
          {data.sessions.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck size={20} />}
              title="No registers recorded today"
              description="Open the attendance page to create a register for one of your classes."
              actions={
                <Link className="btn btn--secondary btn--sm" href="/dashboard/attendance">
                  Take attendance
                </Link>
              }
            />
          ) : (
            <ul className="record-list">
              {data.sessions.map((session) => (
                <li key={session.id} className="record">
                  <div className="record__main">
                    <span className="record__title">{session.className}</span>
                    <div className="record__meta">
                      {session.subjectName ? <span>{session.subjectName}</span> : null}
                      <span>· {session.recordedCount} learners marked</span>
                    </div>
                  </div>
                  <div className="record__actions">
                    <Badge
                      variant={
                        session.isCorrectable && session.recordedCount > 0
                          ? "success"
                          : "pending"
                      }
                    >
                      {session.recordedCount > 0 ? "Recorded" : "Not started"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="quick-actions">
        <Link href="/dashboard/attendance" className="quick-action">
          <CalendarCheck className="quick-action__icon" />
          <span className="quick-action__label">Take attendance</span>
        </Link>
        <Link href="/dashboard/results" className="quick-action">
          <ClipboardCheck className="quick-action__icon" />
          <span className="quick-action__label">Enter marks</span>
        </Link>
      </div>
    </div>
  );
}
