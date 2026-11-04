"use client";

import type { ReactNode } from "react";

export interface TerminalSubject {
  readonly name: string;
  readonly classScore?: number | null;
  readonly examScore?: number | null;
  readonly totalScore?: number | null;
  readonly position?: number | string | null;
  readonly remarks?: string | null;
  readonly grade?: string | null;
  readonly rubric?: "VG" | "G" | "NH" | null;
}

export interface TerminalBills {
  readonly schoolFees?: number | null;
  readonly arrears?: number | null;
  readonly motivationalFees?: number | null;
  readonly maintenanceFees?: number | null;
  readonly firstAid?: number | null;
  readonly total?: number | null;
}

export interface TerminalReportCardProps {
  readonly schoolName: string;
  readonly studentName: string;
  readonly className: string;
  readonly positionInClass?: number | string | null;
  readonly nextTermBegins?: string | null;
  readonly term?: string | null;
  readonly academicYear?: string | null;
  readonly createdAt?: string | null;
  readonly subjects: ReadonlyArray<TerminalSubject>;
  readonly attendance?: number | null;
  readonly totalDays?: number | null;
  readonly conduct?: string | null;
  readonly attitude?: string | null;
  readonly interest?: string | null;
  readonly teacherRemarks?: string | null;
  readonly headTeacherRemarks?: string | null;
  readonly promotedTo?: string | null;
  readonly bills?: TerminalBills | null;
  readonly earlyYears?: boolean;
}

function ordinalSuffix(n: number): string {
  const num = Math.trunc(n);
  const s = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return `${num}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function positionLabel(position: number | string | null | undefined): string {
  if (position === null || position === undefined || position === "-") {
    return "-";
  }
  const numeric = typeof position === "number" ? position : Number(position);
  return Number.isFinite(numeric) ? ordinalSuffix(numeric) : String(position);
}

function money(value: number | null | undefined): string {
  return typeof value === "number" ? `GHS ${value.toFixed(2)}` : "–";
}

export function TerminalReportCard(props: TerminalReportCardProps) {
  const {
    schoolName,
    studentName,
    className,
    positionInClass,
    nextTermBegins,
    term,
    academicYear,
    createdAt,
    subjects,
    attendance,
    totalDays,
    conduct,
    attitude,
    interest,
    teacherRemarks,
    headTeacherRemarks,
    promotedTo,
    bills,
    earlyYears,
  } = props;

  const numericSubjects = subjects.filter(
    (s) => s.classScore !== undefined || s.examScore !== undefined,
  );
  const hasNumeric = numericSubjects.length > 0;

  let totalClass = 0;
  let totalExam = 0;
  let totalOverall = 0;
  let markedSubjects = 0;
  const subjectRows: ReactNode[] = [];

  if (hasNumeric) {
    for (const subject of numericSubjects) {
      const cs = subject.classScore ?? null;
      const es = subject.examScore ?? null;
      const ts =
        subject.totalScore ??
        (cs !== null && es !== null ? cs + es : null);
      if (cs !== null) {
        totalClass += cs;
      }
      if (es !== null) {
        totalExam += es;
      }
      if (ts !== null) {
        totalOverall += ts;
        markedSubjects += 1;
      }
      subjectRows.push(
        <tr key={subject.name}>
          <td>{subject.name}</td>
          <td className="text-center">{cs ?? "–"}</td>
          <td className="text-center">{es ?? "–"}</td>
          <td className="text-center">{ts ?? "–"}</td>
          <td className="text-center">{positionLabel(subject.position)}</td>
          <td>{subject.remarks ?? "-"}</td>
        </tr>,
      );
    }
    subjectRows.push(
      <tr key="total" className="total-row">
        <td>
          <strong>TOTAL</strong>
        </td>
        <td className="text-center">
          <strong>{markedSubjects > 0 ? totalClass.toFixed(1) : "–"}</strong>
        </td>
        <td className="text-center">
          <strong>{markedSubjects > 0 ? totalExam.toFixed(1) : "–"}</strong>
        </td>
        <td className="text-center">
          <strong>{markedSubjects > 0 ? totalOverall.toFixed(1) : "–"}</strong>
        </td>
        <td className="text-center">-</td>
        <td>-</td>
      </tr>,
    );
  } else {
    for (const subject of subjects) {
      subjectRows.push(
        <tr key={subject.name}>
          <td>{subject.name}</td>
          <td className="text-center">{subject.grade ?? "-"}</td>
          <td className="text-center">-</td>
          <td className="text-center">-</td>
          <td className="text-center">-</td>
          <td>{subject.remarks ?? "-"}</td>
        </tr>,
      );
    }
  }

  const posNum =
    typeof positionInClass === "number" ? positionInClass : Number(positionInClass);
  const posDisplay =
    positionInClass !== undefined && positionInClass !== null && positionInClass !== "-" && !Number.isNaN(posNum)
      ? ordinalSuffix(posNum)
      : "To be calculated";

  const createdAtDisplay = createdAt
    ? new Date(createdAt).toLocaleDateString("en-GB")
    : "-";

  const billParts = [
    bills?.schoolFees,
    bills?.arrears,
    bills?.motivationalFees,
    bills?.maintenanceFees,
    bills?.firstAid,
  ];
  const computedBillTotal = billParts.every(
    (value): value is number => typeof value === "number",
  )
    ? billParts.reduce((sum, value) => sum + value, 0)
    : null;
  const billTotal = bills?.total ?? computedBillTotal;

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 0; size: A4 portrait; }
          .terminal-report-card { margin: 0; padding: 10px 15px !important; border: none !important; box-shadow: none !important; min-height: auto !important; width: 100%; box-sizing: border-box; font-size: 9pt; }
          .terminal-report-card * { page-break-inside: avoid; }
          .terminal-report-card table { width: 100%; border-collapse: collapse; }
          .terminal-report-card th, .terminal-report-card td { border: 1px solid #000; padding: 3px 5px; }
        }
      `}</style>
      <div className="terminal-report-card">
        <div className="report-header" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "18pt", margin: 0 }}>{schoolName}</h2>
          <h3 style={{ fontSize: "14pt", margin: "4px 0 6px 0", borderBottom: "1px solid #000", paddingBottom: "4px" }}>
            TERMINAL REPORT SHEET
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 20px", marginTop: "4px", fontSize: "10pt" }}>
            <p style={{ margin: 0 }}><strong>TERM:</strong> {term ?? "-"}</p>
            <p style={{ margin: 0 }}><strong>YEAR:</strong> {academicYear ?? "-"}</p>
            <p style={{ margin: 0 }}><strong>DATE:</strong> {createdAtDisplay}</p>
          </div>
        </div>

        <table className="student-info-table" style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0", fontSize: "9pt" }}>
          <tbody>
            <tr>
              <td style={{ padding: "4px 6px", border: "1px solid #000" }}><strong>NAME:</strong> {studentName}</td>
              <td style={{ padding: "4px 6px", border: "1px solid #000" }}><strong>CLASS:</strong> {className}</td>
            </tr>
            <tr>
              <td style={{ padding: "4px 6px", border: "1px solid #000" }}><strong>POSITION IN CLASS:</strong> {posDisplay}</td>
              <td style={{ padding: "4px 6px", border: "1px solid #000" }}><strong>NEXT TERM BEGINS:</strong> {nextTermBegins ?? "To be announced"}</td>
            </tr>
          </tbody>
        </table>

        {subjects.length === 0 ? (
          <p style={{ margin: "6px 0" }}>No subject data available.</p>
        ) : earlyYears ? (
          <table className="subjects-table" style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0", fontSize: "8pt" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>SUBJECTS</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>VG</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>G</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>NH</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>REMARKS</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => {
                const rating = subject.rubric ?? subject.grade;
                return (
                  <tr key={subject.name}>
                    <td>{subject.name}</td>
                    <td className="text-center">{rating === "VG" ? "✓" : ""}</td>
                    <td className="text-center">{rating === "G" ? "✓" : ""}</td>
                    <td className="text-center">{rating === "NH" ? "✓" : ""}</td>
                    <td>{subject.remarks ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="subjects-table" style={{ width: "100%", borderCollapse: "collapse", margin: "10px 0", fontSize: "8pt" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>SUBJECTS</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>CLASS SCORE</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>EXAM SCORE</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>TOTAL</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>POSITION</th>
                <th style={{ border: "1px solid #000", padding: "4px 6px", background: "#f5f5f5" }}>REMARKS</th>
              </tr>
            </thead>
            <tbody>{subjectRows}</tbody>
          </table>
        )}

        <div className="conduct-section" style={{ margin: "10px 0" }}>
          <table className="conduct-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "8pt" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 6px", border: "1px solid #000" }}><strong>ATTENDANCE:</strong> {attendance ?? "-"} / {totalDays ?? "-"}</td>
                <td style={{ padding: "3px 6px", border: "1px solid #000" }}><strong>PROMOTED TO:</strong> {promotedTo ?? "Same Class"}</td>
              </tr>
              <tr>
                <td style={{ padding: "3px 6px", border: "1px solid #000" }}><strong>CONDUCT:</strong> {(conduct ?? "-").toUpperCase()}</td>
                <td style={{ padding: "3px 6px", border: "1px solid #000" }}><strong>ATTITUDE:</strong> {(attitude ?? "-").toUpperCase()}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ padding: "3px 6px", border: "1px solid #000" }}><strong>INTEREST:</strong> {(interest ?? "-").toUpperCase()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ background: "#f9f9f9", padding: "6px 10px", border: "1px solid #ddd", margin: "6px 0", fontSize: "8pt" }}>
          <p style={{ margin: 0 }}><strong>CLASS TEACHER&apos;S REMARKS:</strong> {(teacherRemarks ?? "-").toUpperCase()}</p>
        </div>
        <div style={{ background: "#f9f9f9", padding: "6px 10px", border: "1px solid #ddd", margin: "6px 0", fontSize: "8pt" }}>
          <p style={{ margin: 0 }}><strong>HEAD TEACHER&apos;S REMARKS:</strong> {(headTeacherRemarks ?? "-").toUpperCase()}</p>
        </div>

        {bills ? (
          <div style={{ margin: "8px 0", padding: "8px 12px", border: "1px solid #000", fontSize: "8pt" }}>
            <h4 style={{ margin: "0 0 4px 0" }}>Next Term Bills</h4>
            <p style={{ margin: "2px 0" }}><strong>School Fees:</strong> {money(bills.schoolFees)}</p>
            <p style={{ margin: "2px 0" }}><strong>Arrears:</strong> {money(bills.arrears)}</p>
            <p style={{ margin: "2px 0" }}><strong>Motivational Fees:</strong> {money(bills.motivationalFees)}</p>
            <p style={{ margin: "2px 0" }}><strong>Maintenance Fees:</strong> {money(bills.maintenanceFees)}</p>
            <p style={{ margin: "2px 0" }}><strong>First Aid:</strong> {money(bills.firstAid)}</p>
            <hr style={{ margin: "4px 0", border: "1px dashed #ccc" }} />
            <p style={{ margin: "2px 0", fontWeight: "bold" }}><strong>TOTAL:</strong> {money(billTotal)}</p>
          </div>
        ) : null}

        <table style={{ width: "100%", border: "none", marginTop: "20px" }}>
          <tbody>
            <tr>
              <td style={{ border: "none", width: "50%", textAlign: "center", paddingTop: "20px" }}>
                <strong>CLASS TEACHER:</strong>
                <br />
                ____________________
                <br />
                <small>Signature &amp; Stamp</small>
              </td>
              <td style={{ border: "none", width: "50%", textAlign: "center", paddingTop: "20px" }}>
                <strong>HEADMASTER:</strong>
                <br />
                ____________________
                <br />
                <small>Signature &amp; Stamp</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}