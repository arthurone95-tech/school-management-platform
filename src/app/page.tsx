import Link from "next/link";
import { useEffect } from "react";
import { site } from "@/config/site";

export default function HomePage() {
  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, []);

  const whatsappUrl = () =>
    `https://wa.me/${"233244123456".replace(/[^0-9]/g, "")}`;

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="site-header border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-medium text-foreground transition-colors hover:underline"
            >
              School Management Platform
            </Link>

            <nav className="hidden sm:block">
              <ul className="flex items-center gap-6">
                <li>
                  <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#who" className="text-muted-foreground hover:text-foreground transition-colors">
                    Who it is for
                  </Link>
                </li>
                <li>
                  <Link href="#security" className="text-muted-foreground hover:text-foreground transition-colors">
                    Security
                  </Link>
                </li>
                <li>
                  <Link href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="flex items-center gap-3">
              <Link
                href="/sign-in"
                className="btn btn--secondary btn--sm"
                style={{ minHeight: "auto", padding: "0.5rem 0.75rem" }}
              >
                Sign in
              </Link>
              <Link
                href={whatsappUrl()}
                className="btn btn--primary btn--sm"
                target="_blank"
                rel="noopener noreferrer"
                style={{ minHeight: "auto", padding: "0.5rem 0.75rem" }}
              >
                Request a demo
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="hero">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h1 className="hero__title text-4xl md:text-5xl font-bold text-foreground mb-4">
            Run your whole school from one place
          </h1>

          <p className="hero__subtitle text-lg text-muted-foreground mb-6">
            Replace paper, exercise books and spreadsheets with one secure system.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="btn btn--primary"
            >
              Request a demo
            </Link>
            <Link
              href="/sign-in"
              className="btn btn--secondary"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Static dashboard preview */}
        <div className="hero__preview mt-12">
          <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
            <div className="card p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold" style={{ color: "#1e40af" }}>
                    1,247
                  </p>
                  <p className="text-sm text-muted-foreground">Students</p>
                </div>
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                  Available now
                </span>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-2xl font-bold" style={{ color: "#1e40af" }}>
                    89
                  </p>
                  <p className="text-sm text-muted-foreground">Classes</p>
                </div>
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                  Available now
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="section" id="features">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="section__title text-3xl font-bold text-foreground mb-8">
            Available now
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Available now cards */}
            <div className="feature-card p-4 rounded-lg border group">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 group-hover:bg-primary/5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2 6h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h4l2-6h4L21 5L10 1L2 9v4zM3 11L2 14l2-6h6l2 6h6L23 11L14 21h-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Students and enrolment</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Register students, assign classes, track attendance
              </p>
            </div>

            <div className="feature-card p-4 rounded-lg border group">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 group-hover:bg-primary/5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2 6h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h-4a2 2 0 0 1 2-2h-4l2-6h4L21 5L10 1L2 9v4zM3 11L2 14l2-6h6l2 6h6L23 11L14 21h-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Class attendance</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Take attendance, mark present/absent, historical view
              </p>
            </div>

            <div className="feature-card p-4 rounded-lg border group">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 group-hover:bg-primary/5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2 6h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h-4a2 2 0 0 1 2-2h-4l2-6h4L21 5L10 1L2 9v4zM3 11L2 14l2-6h6l2 6h6L23 11L14 21h-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Results and grading</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Enter marks, calculate grades, generate report cards
              </p>
            </div>

            <div className="feature-card p-4 rounded-lg border group">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 group-hover:bg-primary/5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2 6h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h-4a2 2 0 0 1 2-2h-4l2-6h4L21 5L10 1L2 9v4zM3 11L2 14l2-6h6l2 6h6L23 11L14 21h-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Staff and roles</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Manage teachers, administrators, and permissions
              </p>
            </div>

            <div className="feature-card p-4 rounded-lg border group">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 group-hover:bg-primary/5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2 6h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2v-4a2 2 0 0 1 2-2h-4l2-6h4L21 5L10 1L2 9v4zM3 11L2 14l2-6h6l2 6h6L23 11L14 21h-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Import and export</h3>
              <p className="text-xs text-muted-foreground mb-2">
                CSV import/export for students, grades, and attendance
              </p>
            </div>

            <div className="feature-card p-4 rounded-lg border group">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 group-hover:bg-primary/5">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"/>
                  <circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2 6h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h-4a2 2 0 0 1 2-2h-4l2-6h4L21 5L10 1L2 9v4zM3 11L2 14l2-6h6l2 6h6L23 11L14 21h-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                School settings (terms, subjects, grade bands)
              </h3>
              <p className="text-xs text-muted-foreground mb-2">
                Configure academic years, terms, subjects, and grading bands
              </p>
            </div>
          </div>

          {/* Coming soon cards */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="feature-card p-4 rounded-lg border">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 bg-primary/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="3" r="4"/>
                  <circle cx="9" cy="21" r="4"/>
                  <path d="M5 13h14"/>
                  <path d="M9 21h14l2-8"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Fees and receipts</h3>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                Coming soon
              </span>
            </div>

            <div className="feature-card p-4 rounded-lg border">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 bg-primary/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="3" r="4"/>
                  <circle cx="9" cy="21" r="4"/>
                  <path d="M5 13h14"/>
                  <path d="M9 21h14l2-8"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Student and parent portal
              </h3>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                Coming soon
              </span>
            </div>

            <div className="feature-card p-4 rounded-lg border">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 bg-primary/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="3" r="4"/>
                  <circle cx="9" cy="21" r="4"/>
                  <path d="M5 13h14"/>
                  <path d="M9 21h14l2-8"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">
                Announcements and SMS
              </h3>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Who it is for section */}
      <section className="section" id="who">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="section__title text-3xl font-bold text-foreground mb-8">
            Who it is for
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="feature-card p-4 rounded-lg border">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 bg-primary/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 2l20 20M2 2L22 22L4.93 4.93M16 16L20 20M4.93 4.93L22 22L20 20"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">School administrators</h3>
            </div>

            <div className="feature-card p-4 rounded-lg border">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 bg-primary/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 3h6a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4h2"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Teachers</h3>
            </div>

            <div className="feature-card p-4 rounded-lg border">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 bg-primary/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="21" r="1"/>
                  <path d="M21 15l-5-5l5-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Students</h3>
            </div>

            <div className="feature-card p-4 rounded-lg border">
              <div className="w-8 h-8 rounded-md flex items-center justify-center mb-3 bg-primary/10">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="21" r="1"/>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <path d="M21 15l-5-5l5-5"/>
                </svg>
              </div>
              <h3 className="text-sm font-medium text-foreground mb-1">Parents</h3>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section className="section" id="how">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="section__title text-3xl font-bold text-foreground mb-8">
            How a school gets started
          </h2>

          <ol className="space-y-4 max-w-2xl">
            <li className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">1</span>
              </div>
              <div className="ml-3">
                <p className="font-medium">We set up your school</p>
                <p className="text-sm text-muted-foreground">
                  The platform team configures your school profile, code, and initial settings.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">2</span>
              </div>
              <div className="ml-3">
                <p className="font-medium">You add classes and staff</p>
                <p className="text-sm text-muted-foreground">
                  Import or create classes and invite teachers and administrators.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">3</span>
              </div>
              <div className="ml-3">
                <p className="font-medium">Teachers take attendance and enter marks</p>
                <p className="text-sm text-muted-foreground">
                  Daily attendance and assessment entry through the simple interface.
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">4</span>
              </div>
              <div className="ml-3">
                <p className="font-medium">You see reports</p>
                <p className="text-sm text-muted-foreground">
                  Generate automatic reports on student performance, attendance, and grades.
                </p>
              </div>
            </li>
          </ol>
        </div>
      </section>

      {/* Security section */}
      <section className="section" id="security" style={{ background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <h2 className="section__title text-3xl font-bold text-foreground mb-8">
            Security in plain words
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div className="p-4 rounded-lg border">
              <p className="font-medium">Each school information is kept separate from every other school.</p>
              <p className="text-sm text-muted-foreground mt-1">
                No school can access another school records, even administratively.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="font-medium">Records are corrected, never silently deleted.</p>
              <p className="text-sm text-muted-foreground mt-1">
                Every change is logged with who made it and when.
              </p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="font-medium">No jargon just straightforward data protection.</p>
              <p className="text-sm text-muted-foreground mt-1">
                The platform follows clear auditable rules for school data isolation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA + Footer */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-4">Get started today</h3>
              <p className="text-muted-foreground mb-4">
                Join the schools already using the platform to replace paper and spreadsheets.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/register"
                  className="btn btn--primary"
                >
                  Register your school
                </Link>
                <Link
                  href={whatsappUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--secondary"
                >
                  WhatsApp us
                </Link>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-bold text-foreground mb-3">Contact</h4>
              <p className="text-muted-foreground mb-2">{site.tagline}</p>
              <p className="text-sm text-muted-foreground">
                <a href="mailto:contact@schoolplatform.edu" className="underline">
                  contact@schoolplatform.edu
                </a>
              </p>
              <p className="text-sm text-muted-foreground">
                +233 244 123 456
              </p>
            </div>
          </div>

          <footer className="mt-8 text-sm text-muted-foreground">
            © {new Date().getFullYear()} School Management Platform. All rights reserved.
          </footer>
        </div>
      </section>
    </main>
  );
}