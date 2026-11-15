import Link from "next/link";

/**
 * Admin sidebar navigation.
 *
 * Organized into named tabs matching the 30+ admin features specification.
 * Each section groups related functionality per the specification.
 */
export function AdminSidebar() {
  return (
    <nav className="border-right border-border flex flex-col h-screen p-4 shrink-0">
      <ul className="space-y-2 text-sm font-medium">
        {/* A. DASHBOARD */}
        <li>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Dashboard
          </Link>
        </li>

        {/* B. STUDENT MANAGEMENT */}
        <li>
          <Link
            href="/dashboard/learners"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Students
          </Link>
        </li>

        {/* C. TEACHER AND STAFF MANAGEMENT */}
        <li>
          <Link
            href="/dashboard/staff"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Staff
          </Link>
        </li>

        {/* D. ACADEMICS TAB */}
        <li>
          <Link
            href="/dashboard/academics"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Academics
          </Link>
        </li>

        {/* E. EXAMINATION MANAGEMENT */}
        <li>
          <Link
            href="/dashboard/examinations"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Examinations
          </Link>
        </li>

        {/* F. ASSESSMENT AND GRADING */}
        <li>
          <Link
            href="/dashboard/grading"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Grading
          </Link>
        </li>

        {/* G. RESULTS */}
        <li>
          <Link
            href="/dashboard/results"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Results
          </Link>
        </li>

        {/* H. ATTENDANCE */}
        <li>
          <Link
            href="/dashboard/attendance"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Attendance
          </Link>
        </li>

        {/* I. PARENT AND STUDENT ACCOUNTS */}
        <li>
          <Link
            href="/dashboard/accounts"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Accounts
          </Link>
        </li>

        {/* J. COMMUNICATION AND ANNOUNCEMENTS */}
        <li>
          <Link
            href="/dashboard/communication"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Communication
          </Link>
        </li>

        {/* K. SCHOOL SETTINGS */}
        <li>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Settings
          </Link>
        </li>

        {/* L. SECURITY AND SYSTEM ADMINISTRATION */}
        <li>
          <Link
            href="/dashboard/security"
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-primary/5 transition-colors"
          >
            Security
          </Link>
        </li>
      </ul>
    </nav>
  );
}