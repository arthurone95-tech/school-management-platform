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
}: {
  readonly schoolName: string | null;
  readonly metrics: DashboardMetrics;
}) {
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
        <h1>School overview</h1>
        <p className="muted">
          {schoolName ?? "Your school"} — high-level metrics for your school.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {cards.map((card) => {
          const inner = (
            <Card>
              <CardHeader title={card.label} />
              <CardBody>
                <p style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
                  {card.value}
                </p>
              </CardBody>
            </Card>
          );
          return card.href ? (
            <Link key={card.label} href={card.href} style={{ textDecoration: "none" }}>
              {inner}
            </Link>
          ) : (
            <div key={card.label}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}