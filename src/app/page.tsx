export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: "44rem" }}>
      <h1>School Management Platform</h1>
      <p>
        The secure-first foundation (phase 1) is implemented and verified
        against the non-production Supabase project. Current capabilities:
      </p>
      <ul>
        <li>
          <strong>Student portal:</strong> administrators issue single-use
          activation codes; students sign in with their school code, username
          and password.
        </li>
        <li>
          <strong>Staff:</strong> email + password sign-in, and
          administrator-issued invitations delivered by email link; invited
          staff activate their membership on first sign-in.
        </li>
        <li>
          <strong>School isolation:</strong> access is enforced by Row Level
          Security and server-side checks; an account can never reach another
          school&apos;s data.
        </li>
      </ul>
      <p>
        The staff-facing interface (dashboard and sign-in pages) is the next
        phase and is not available yet. Until then the flows are exercised
        through the API and the live test suites under <code>tests/live/</code>.
      </p>
    </main>
  );
}
