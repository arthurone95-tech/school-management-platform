import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { StatusPage } from "@/components/ui/status-page";

import { PrintReportCardButton } from "./print-report-card-button";

export const metadata: Metadata = {
  title: "Student home | School Management Platform",
};

/**
 * Student home (D-020).
 *
 * The portal home is still being built out; this page provides the print
 * action and print-specific styles for a student's terminal report card.
 */
export default function PortalHomePage() {
  return (
    <StatusPage title="Student home">
      <Alert variant="info" role={null}>
        This page is not available yet.
      </Alert>

      <p className="muted">
        The student portal home is still being built. When it is ready, you will
        see your classes, attendance and published results here after signing in.
      </p>

      <div className="portal-report-card-actions">
        <PrintReportCardButton />
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .terminal-report-card,
          .terminal-report-card *,
          .report-card-signoff,
          .report-card-signoff * {
            visibility: visible;
          }

          .terminal-report-card {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            border: none;
            padding: 10px 15px;
            color: #000;
            background: #fff;
            overflow: visible;
          }

          .portal-report-card-actions {
            display: none;
          }
        }
      `}</style>

      <p className="muted">
        <Link href="/portal/sign-in" className="link">
          Go to student sign-in
        </Link>
      </p>
    </StatusPage>
  );
}
