Phase 1: Public Face - DONE ✅

Summary:
Successfully implemented the public face of the School Management Platform, enabling visitors to understand the product in 10 seconds and allowing administrators to sign in.

Landing page (/):
- Top bar: product name "School Management Platform" on left
- Links: Features, Who it is for, Security, Contact (collapse into menu on phones)
- Right side: Sign in (secondary) and Request a demo (primary, opens WhatsApp)
- Hero: "Run your whole school from one place" + supporting sentence
- Two CTA buttons: Request a demo, Sign in
- Static dashboard preview with sample numbers (1,247 Students, 89 Classes)
- Features grid: 6 "Available now" cards, 3 "Coming soon" cards (StatusBadge)
- Who it is for: 4 cards (Administrators, Teachers, Students, Parents - Parents Coming soon)
- How it works: 4 numbered steps
- Security in plain words: 3 short statements
- Closing CTA + footer with contact details from site.ts and current year

Sign-in page (/sign-in):
- Centred card on page background
- Product name "School Management Platform" above the form
- Existing sign-in form (logic unchanged)
- Link back to home page
- Note: students will have their own sign-in soon

Quality Gates:
- typecheck: ✅ 0 errors
- lint: ✅ 0 errors (73 pre-existing warnings)
- test: ✅ 292 tests pass

New files created:
- src/config/site.ts - product configuration (placeholders)
- src/app/page.tsx - landing page replacement
- src/app/sign-in/page.tsx - sign-in page redesign

Files modified (no changes to api, lib, supabase):
- src/app/page.tsx - landing page
- src/app/sign-in/page.tsx - sign-in page
- src/app/globals.css - added Landing and public pages CSS section

Navigation flow:
/ (Home) → Sign in → /sign-in
/ (Home) → Register → /register

The implementation is complete and verified. All changes are on the feature/dual-mode-assessment-framework branch.