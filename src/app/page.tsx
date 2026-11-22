import Link from "next/link";
import type { ReactNode } from "react";
import { site } from "@/config/site";

/* Styling for this page lives in globals.css, in the "Landing page
   (landing-*)" block. No Tailwind classes are used here. */

/* ------------------------------ Icons ---------------------------------- */

type IconName =
  | "students"
  | "attendance"
  | "results"
  | "staff"
  | "data"
  | "settings"
  | "fees"
  | "messages"
  | "admin"
  | "teacher"
  | "student"
  | "parent"
  | "check";

const iconPaths: Record<IconName, ReactNode> = {
  students: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  attendance: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </>
  ),
  results: (
    <>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </>
  ),
  staff: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  data: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  settings: (
    <>
      <path d="M21 4h-7" />
      <path d="M10 4H3" />
      <path d="M21 12h-9" />
      <path d="M8 12H3" />
      <path d="M21 20h-5" />
      <path d="M12 20H3" />
      <path d="M14 2v4" />
      <path d="M8 10v4" />
      <path d="M16 18v4" />
    </>
  ),
  fees: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  messages: (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  admin: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  teacher: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  student: (
    <>
      <path d="M22 10 12 5 2 10l10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  parent: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

/* ------------------------------ Content -------------------------------- */

const available: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "students",
    title: "Students and enrolment",
    text: "Register students, assign classes, track attendance.",
  },
  {
    icon: "attendance",
    title: "Class attendance",
    text: "Take attendance, mark present or absent, and look back at any day.",
  },
  {
    icon: "results",
    title: "Results and grading",
    text: "Enter marks, calculate grades, generate report cards.",
  },
  {
    icon: "staff",
    title: "Staff and roles",
    text: "Manage teachers, administrators, and permissions.",
  },
  {
    icon: "data",
    title: "Import and export",
    text: "CSV import and export for students, grades, and attendance.",
  },
  {
    icon: "settings",
    title: "School settings",
    text: "Set up academic years, terms, subjects, and grade bands.",
  },
];

const comingSoon: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "fees",
    title: "Fees and receipts",
    text: "Record payments and print receipts.",
  },
  {
    icon: "messages",
    title: "Announcements and SMS",
    text: "Send notices to staff, students, and parents.",
  },
];

const audiences: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "admin",
    title: "Administrators",
    text: "Set up classes, staff, and terms, then see reports for the whole school.",
  },
  {
    icon: "teacher",
    title: "Teachers",
    text: "Take attendance and enter marks from one simple screen.",
  },
  {
    icon: "student",
    title: "Students",
    text: "Sign in to the student portal using the credentials your school gives you.",
  },
  {
    icon: "parent",
    title: "Parents",
    text: "Parent access is coming soon.",
  },
];

const steps = [
  {
    title: "We set up your school",
    text: "The platform team configures your school profile, code, and initial settings.",
  },
  {
    title: "You add classes and staff",
    text: "Import or create classes and invite teachers and administrators.",
  },
  {
    title: "Teachers take attendance and enter marks",
    text: "Daily attendance and assessment entry through a simple interface.",
  },
  {
    title: "You see reports",
    text: "Generate automatic reports on student performance, attendance, and grades.",
  },
];

const security = [
  {
    title: "Each school's information is kept separate.",
    text: "No school can access another school's records, even administratively.",
  },
  {
    title: "Records are corrected, never silently deleted.",
    text: "Every change is logged with who made it and when.",
  },
  {
    title: "Straightforward data protection.",
    text: "The platform follows clear, auditable rules for school data isolation.",
  },
];

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#who", label: "Who it's for" },
  { href: "#how", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#contact", label: "Contact" },
];

/* ------------------------------- Page ---------------------------------- */

export default function HomePage() {
  const whatsappUrl = `https://wa.me/${site.whatsappNumber.replace(/[^0-9]/g, "")}`;

  return (
    <main className="page">
      {/* ---------------------------- Header ---------------------------- */}
      <header className="landing-header">
        <div className="landing-container landing-header__inner">
          <Link href="/" className="landing-brand">
            School Management Platform
          </Link>

          <nav className="landing-nav" aria-label="Main">
            <ul>
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="landing-header__actions">
            <span className="landing-hide-sm">
              <Link href="/sign-in" className="btn btn--secondary btn--sm">
                Sign in
              </Link>
            </span>
            <a
              href="/signup"
              className="btn btn--primary btn--sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Signup
            </a>
            <a
              href={whatsappUrl}
              className="btn btn--primary btn--sm"
              target="_blank"
              rel="noopener noreferrer"
            >
              Request a demo
            </a>
          </div>
        </div>
      </header>

      {/* ----------------------------- Hero ----------------------------- */}
      <section className="landing-hero">
        <div className="landing-container landing-hero__inner">
          <div>
            <h1 className="landing-title">Run your whole school from one place</h1>
            <p className="landing-lead">
              Replace paper, exercise books and spreadsheets with one secure,
              easy-to-use system for attendance, grading and reporting.
            </p>
            <div className="landing-actions">
              <a
                href="/signup"
                className="btn btn--primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Signup
              </a>
              <a
                href={whatsappUrl}
                className="btn btn--primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Request a demo
              </a>
              <Link href="/sign-in" className="btn btn--secondary">
                Sign in
              </Link>
            </div>
          </div>

          {/* Static preview. The numbers are sample data and labelled so. */}
          <div className="landing-preview" aria-label="Sample dashboard preview">
            <div className="landing-preview__head">
              <span>School overview</span>
              <span className="landing-pill">Sample data</span>
            </div>
            <div className="landing-stats">
              <div className="landing-stat">
                <p className="landing-stat__value">1,247</p>
                <p className="landing-stat__label">Students</p>
              </div>
              <div className="landing-stat">
                <p className="landing-stat__value">89</p>
                <p className="landing-stat__label">Classes</p>
              </div>
              <div className="landing-stat landing-stat--wide">
                <div className="landing-stat__row">
                  <span className="muted">Attendance today</span>
                  <strong>94%</strong>
                </div>
                <div className="landing-meter">
                  <div className="landing-meter__fill" style={{ width: "94%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --------------------------- Features --------------------------- */}
      <section className="landing-section" id="features">
        <div className="landing-container">
          <h2 className="landing-heading">Available now</h2>
          <p className="landing-intro">
            Everything a school needs for daily records, from the first
            enrolment to the printed report card.
          </p>

          <div className="landing-grid landing-grid--3">
            {available.map((item) => (
              <div key={item.title} className="landing-card">
                <div className="landing-card__icon">
                  <Icon name={item.icon} />
                </div>
                <h3 className="landing-card__title">{item.title}</h3>
                <p className="landing-card__text">{item.text}</p>
              </div>
            ))}
          </div>

          <h3 className="landing-subheading">Coming soon</h3>
          <div className="landing-grid landing-grid--2 landing-grid--tight">
            {comingSoon.map((item) => (
              <div key={item.title} className="landing-card landing-card--soon">
                <div className="landing-soon">
                  <div className="landing-card__icon">
                    <Icon name={item.icon} />
                  </div>
                  <div>
                    <div className="landing-soon__title">
                      <h4 className="landing-card__title">{item.title}</h4>
                      <span className="landing-pill">Coming soon</span>
                    </div>
                    <p className="landing-card__text">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------- Who it is for ------------------------ */}
      <section className="landing-section landing-section--alt" id="who">
        <div className="landing-container">
          <h2 className="landing-heading">Who it&apos;s for</h2>
          <p className="landing-intro">
            One platform, with a separate view for each person in the school.
          </p>

          <div className="landing-grid landing-grid--4">
            {audiences.map((item) => (
              <div key={item.title} className="landing-card">
                <div className="landing-card__icon">
                  <Icon name={item.icon} />
                </div>
                <h3 className="landing-card__title">{item.title}</h3>
                <p className="landing-card__text">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------- How it works ------------------------- */}
      <section className="landing-section" id="how">
        <div className="landing-container">
          <h2 className="landing-heading">How a school gets started</h2>

          <ol className="landing-grid landing-grid--4 landing-steps">
            {steps.map((step, index) => (
              <li key={step.title} className="landing-card">
                <span className="landing-step__number">{index + 1}</span>
                <h3 className="landing-card__title">{step.title}</h3>
                <p className="landing-card__text">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------- Security -------------------------- */}
      <section className="landing-section landing-section--alt" id="security">
        <div className="landing-container">
          <h2 className="landing-heading">Security in plain words</h2>

          <div className="landing-grid landing-grid--3">
            {security.map((item) => (
              <div key={item.title} className="landing-card">
                <div className="landing-card__icon">
                  <Icon name="check" />
                </div>
                <h3 className="landing-card__title">{item.title}</h3>
                <p className="landing-card__text">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------- Closing call to action -------------------- */}
      <section className="landing-section" id="contact">
        <div className="landing-container landing-cta">
          <div>
            <h2 className="landing-heading">Get started today</h2>
            <p className="landing-intro">
              Join the schools already using the platform to replace paper and
              spreadsheets.
            </p>
            <div className="landing-actions">
              <a
                href={whatsappUrl}
                className="btn btn--primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Request a demo
              </a>
              <Link href="/sign-in" className="btn btn--secondary">
                Sign in
              </Link>
              <Link href="/portal/sign-in" className="btn btn--secondary">
                Student portal
              </Link>
            </div>
          </div>

          <div className="landing-contact">
            <h3 className="landing-contact__title">Contact</h3>
            <p>{site.tagline}</p>
            <p>
              <a href="mailto:contact@schoolplatform.edu" className="link">
                contact@schoolplatform.edu
              </a>
            </p>
            <p>{site.contactPhone}</p>
          </div>
        </div>
      </section>

      {/* ---------------------------- Footer ---------------------------- */}
      <footer className="landing-footer">
        <div className="landing-container">
          © 2026 School Management Platform. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
