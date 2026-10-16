import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "44rem" }}>
      <h1>School Management Platform</h1>
      <p>
        <Link className="link" href="/sign-in">
          Staff sign-in
        </Link>
      </p>
      <p>
        The secure-first foundation and the first school workflows are
        implemented and verified against the non-production Supabase project.
        Current capabilities:
      </p>
      <ul>
        <li>
          <strong>Student portal:</strong> administrators issue single-use
          activation codes; students sign in with their school code, username
          and password.
        </li>
        <li>
          <strong>Staff:</strong> email + password sign-in, and
          administrator-issued invitations shared as a single-use activation
          link (no email delivery required); the invited person sets a password
          and activates their membership by opening the link at{" "}
          <code>/join</code>.
        </li>
        <li>
          <strong>Enrolment:</strong> an administrator registers a student with
          their class placement, corrects a record, deactivates or reactivates a
          student, and changes a class placement — through the
          administrator-only <code>/dashboard/learners</code> page.
        </li>
        <li>
          <strong>Classes:</strong> an administrator creates, renames,
          deactivates and reactivates the school&apos;s classes through{" "}
          <code>/dashboard/classes</code>.
        </li>
        <li>
          <strong>School isolation:</strong> access is enforced by Row Level
          Security and server-side checks; an account can never reach another
          school&apos;s data.
        </li>
      </ul>
      <p>
        The administrator dashboard (<code>/dashboard</code>) and the sign-in
        page (<code>/sign-in</code>) are available, and every action is also
        exercised through the live test suites under <code>tests/live/</code>.
      </p>
    </main>
  );
}
