import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface SignupBody {
  readonly schoolName: string;
  readonly schoolCode: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const SCHOOL_CODE_RE = /^[A-HJ-NP-RT-Y0-9]{4,10}$/;
const SCHOOL_CODE_ERROR =
  "School code must be 4–10 characters. Don't use I, O, S or Z — they look like 1, 0, 5 and 2.";

type ParseResult =
  | { readonly ok: true; readonly value: SignupBody }
  | { readonly ok: false; readonly error: string };

function parseBody(value: unknown): ParseResult {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const record = value as Record<string, unknown>;
  const schoolName = record.schoolName;
  const schoolCode = record.schoolCode;
  const adminEmail = record.adminEmail;
  const adminPassword = record.adminPassword;

  if (
    typeof schoolName !== "string" ||
    schoolName.trim().length < 2 ||
    schoolName.trim().length > 120
  ) {
    return {
      ok: false,
      error: "School name must be between 2 and 120 characters.",
    };
  }
  if (typeof schoolCode !== "string" || !SCHOOL_CODE_RE.test(schoolCode)) {
    return { ok: false, error: SCHOOL_CODE_ERROR };
  }
  if (typeof adminEmail !== "string" || adminEmail.trim().length < 6) {
    return {
      ok: false,
      error: "Administrator email must be at least 6 characters.",
    };
  }
  if (typeof adminPassword !== "string" || adminPassword.trim().length < 6) {
    return {
      ok: false,
      error: "Administrator password must be at least 6 characters.",
    };
  }

  return {
    ok: true,
    value: {
      schoolName: schoolName.trim(),
      schoolCode,
      adminEmail: adminEmail.trim(),
      adminPassword: adminPassword.trim(),
    },
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const parsed = parseBody(body);
  if (!parsed.ok) {
    return json({ ok: false, error: parsed.error }, 400);
  }

  const { schoolName, schoolCode, adminEmail, adminPassword } = parsed.value;

  const admin = createSupabaseAdminClient();

  // 1. Create the school.
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ name: schoolName, code: schoolCode })
    .select("id, name, code")
    .single<{ id: string; name: string; code: string }>();

  if (schoolError || !school) {
    if (schoolError?.code === "23505") {
      return json({ ok: false, error: "That school code is already in use." }, 409);
    }
    return json({ ok: false, error: "The school could not be created." }, 500);
  }

  // 2. Create the administrator's Auth account (confirmed - can sign in immediately).
  // We set email_confirm: true so the account is immediately active.
  const { data: userData, error: userError } =
    await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // <-- confirmed: immediate sign-in
      app_metadata: { provisioned_by: "school-platform", school_id: school.id },
    });

  if (userError || !userData.user) {
    // Best-effort cleanup of the school row we just created.
    await admin.from("schools").delete().eq("id", school.id);
    const exists =
      userError?.code === "email_exists" ||
      userError?.code === "user_already_exists" ||
      userError?.message === "User already registered";
    return json(
      {
        ok: false,
        error: exists
          ? "That email already has an account."
          : "The administrator account could not be created.",
      },
      exists ? 409 : 500,
    );
  }

  const userId = userData.user.id;

  // 3. Link the user to the school as an active school_administrator.
  // The user will need to verify their email before signing in, but the membership
  // record is created now so that once verified, they immediately have access.
  const { error: membershipError } = await admin.from("school_members").insert({
    school_id: school.id,
    user_id: userId,
    role: "school_administrator",
    status: "active",
  });

  if (membershipError) {
    await admin.auth.admin.deleteUser(userId);
    await admin.from("schools").delete().eq("id", school.id);
    return json(
      { ok: false, error: "The membership could not be created." },
      500,
    );
  }

  // 4. Seed default grading bands.
  const DEFAULT_GRADE_BANDS = [
    { minPercentage: 0, label: "F", remark: "Fail", isPassing: false },
    { minPercentage: 40, label: "D", remark: "Pass", isPassing: true },
    { minPercentage: 50, label: "C", remark: "Credit", isPassing: true },
    { minPercentage: 60, label: "B", remark: "Good", isPassing: true },
    { minPercentage: 70, label: "A", remark: "Very Good", isPassing: true },
    { minPercentage: 80, label: "A+", remark: "Excellent", isPassing: true },
  ];

  const { error: bandsError } = await admin.from("grade_bands").insert(
    DEFAULT_GRADE_BANDS.map((band) => ({
      school_id: school.id,
      min_percentage: band.minPercentage,
      label: band.label,
      remark: band.remark,
      is_passing: band.isPassing,
    })),
  );

  if (bandsError) {
    // Bands are convenience data; report success.
    // Email is confirmed, admin can sign in immediately.
    return json(
      {
        ok: true,
        needsEmailVerification: false,
        school: { id: school.id, name: school.name, code: school.code },
        admin: {
          email: adminEmail,
          userId,
          // Password not exposed for security.
        },
        message:
          "School created successfully. The administrator account is confirmed and ready to use.",
      },
      201,
    );
  }

  // 5. Success - school created, admin created, membership linked, grade bands seeded.
  // Email is confirmed, admin can sign in immediately without verification.
  return json(
    {
      ok: true,
      needsEmailVerification: false,
      school: { id: school.id, name: school.name, code: school.code },
      admin: {
        email: adminEmail,
        userId,
      },
      message:
        "School created successfully. The administrator account is confirmed and ready to use.",
    },
    201,
  );
}