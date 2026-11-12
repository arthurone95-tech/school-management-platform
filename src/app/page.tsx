import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "44rem", margin: "0 auto" }}>
      <h1 style={{ textAlign: "center", marginBottom: "1.5rem" }}>
        School Management Platform
      </h1>

      <p style={{ textAlign: "center", marginBottom: "2rem", fontSize: "1.1rem" }}>
        Secure-first foundation for school administration verified against the
        non-production Supabase project.
      </p>

      <div style={{ display: "grid", gap: "1rem", maxWidth: "30rem", margin: "0 auto" }}>
        <Link
          className="link"
          style={{
            display: "block",
            padding: "1rem",
            background: "var(--primary-600)",
            color: "white",
            borderRadius: "0.5rem",
            textAlign: "center",
            textDecoration: "none",
            fontWeight: "500",
          }}
          href="/sign-in"
        >
          Staff Sign-In
        </Link>

        <Link
          className="link"
          style={{
            display: "block",
            padding: "1rem",
            background: "var(--primary-500)",
            color: "white",
            borderRadius: "0.5rem",
            textAlign: "center",
            textDecoration: "none",
            fontWeight: "500",
          }}
          href="/register"
        >
          Register New School
        </Link>
      </div>

      <p style={{ marginTop: "2rem", textAlign: "center", fontSize: "0.9rem", color: "var(--muted-foreground)" }}>
        The secure-first foundation and the first school workflows are implemented
        and verified against the non-production Supabase project.
      </p>

      <ul style={{ marginTop: "1.5rem", textAlign: "center" }}>
        <li>
          <strong>Student portal:</strong> administrators issue single-use activation
          codes; students sign in with their school code, username and password.
        </li>
        <li>
          <strong>Staff:</strong> email + password sign-in, and administrator-issued
          invitations shared as a single-use activation link (no email delivery
          required); the invited person sets a password and activates their
          membership by opening the link at /join.
        </li>
        <li>
          <strong>Enrolment:</strong> an administrator registers a student with their
          class placement, corrects a record, deactivates or reactivates a student,
          and changes a class placement — through the administrator-only{" "}
          <code>/dashboard/learners</code> page.
        </li>
        <li>
          <strong>Classes:</strong> an administrator creates, renames, deactivates and
          reactivates the school classes through <code>/dashboard/classes</code>.
        </li>
        <li>
          <strong>School isolation:</strong> access is enforced by Row Level Security
          and server-side checks; an account can never reach another school data.
        </li>
      </ul>
    </main>
  );
}