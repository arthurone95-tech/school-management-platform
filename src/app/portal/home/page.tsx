import type { Metadata } from "next";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Student home | School Management Platform",
};

function StudentHome({ name, grade, attendance, results, className }: {
  readonly name: string;
  readonly grade: string;
  readonly attendance: number;
  readonly results: Array<{ subject: string; grade: string; remark: string }>;
  readonly className: string;
}) {
  const [printing, setPrinting] = useState(false);

  return (
    <div className="stack">
      <h1>Student home</h1>

      <div className="card p-4">
        <h2>Welcome, {name}</h2>

        <p className="muted">
          Class: {className}
        </p>

        {/* Attendance summary */}
        <div className="dashboard-checklist">
          <h2 className="dashboard-checklist-title">Attendance</h2>
          <p className="muted">
            Attendance this term: {attendance}%
          </p>
        </div>

        {/* Results summary */}
        {results.length > 0 ? (
          <div>
            <h2 className="dashboard-checklist-title">Results</h2>
            <ol>
              {results.map((result, index) => (
                <li key={index} className="dashboard-checklist-item">
                  <span className="dashboard-checklist-icon">
                    {result.grade.includes("A") || result.grade.includes("B") ? "✓" : ""}
                  </span>
                  <span className="dashboard-checklist-label">
                    {result.subject}: {result.grade}
                    {result.remark && ` — ${result.remark}`}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="muted">
            No published results yet. Check back later or ask your teacher.
          </p>
        )}

        {/* Print button */}
        <Button
          onClick={() => setPrinting(true)}
          className="btn btn--secondary w-100 mb-3"
        >
          Print report card
        </Button>

        {printing && (
          <div className="alert alert--info">
            <p>Opening print view…</p>
            <Button onClick={() => window.print()} className="btn btn--primary">
              Print
            </Button>
            <Button onClick={() => setPrinting(false)} className="btn btn--secondary">
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PortalHomePage({
  schoolName,
}: {
  readonly schoolName: string | null;
}) {
  const [student, setStudent] = useState<{
    name: string;
    grade: string;
    attendance: number;
    results: Array<{ subject: string; grade: string; remark: string }>;
    className: string;
  } | null>(null);

  useEffect(() => {
    // Fetch student portal data
    const checkStudent = async () => {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = createSupabaseServerClient();
      const { data } = await supabase.auth.getUser();

      if (data.user && data.user.app_metadata) {
        const meta = data.user.app_metadata;
        if (meta.student_name) {
          setStudent({
            name: meta.student_name,
            grade: meta.grade_level || "N/A",
            attendance: meta.attendance_percentage ?? 0,
            results: (meta.results || []).map((r: any) => ({
              subject: r.subject || "Unknown",
              grade: r.grade || "No grade",
              remark: r.remark || "",
            })),
            className: meta.class_name || "Unknown class",
          });
        }
      }
    };

    checkStudent();
  }, []);

  if (!student) {
    return (
      <div className="stack">
        <h1>Student home</h1>
        <p className="muted">
          Loading your student home…
        </p>
        <p className="muted">
          If you are already signed in, please wait a moment. If you need to sign
          in, use the sign-in page.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <StudentHome
        name={student.name}
        grade={student.grade}
        attendance={student.attendance}
        results={student.results}
        className={student.className}
      />
    </div>
  );
}