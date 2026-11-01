import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * One-shot tenant provisioning (D-style, operational tooling).
 *
 * Secured by a shared secret in the `x-provision-secret` header rather than by a
 * school session: provisioning creates the first school and its first
 * administrator, so there is no caller to authorize against yet. The secret is
 * server-only (`PROVISIONING_SECRET`) and must never be shipped to a browser.
 */

const SCHOOL_CODE_RE = /^[A-HJ-NP-RT-Y0-9]{4,10}$/;

interface ProvisionBody {
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

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

function parseBody(value: unknown): ProvisionBody | null {
  if (typeof value !== "object" || value === null) return null;
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
    return null;
  }
  if (typeof schoolCode !== "string" || !SCHOOL_CODE_RE.test(schoolCode)) {
    return null;
  }
  if (typeof adminEmail !== "string" || !isEmail(adminEmail)) {
    return null;
  }
  if (typeof adminPassword !== "string" || adminPassword.length < 8) {
    return null;
  }
  return {
    schoolName: schoolName.trim(),
    schoolCode,
    adminEmail: adminEmail.trim().toLowerCase(),
    adminPassword,
  };
}

const DEFAULT_GRADE_BANDS: ReadonlyArray<{
  minPercentage: number;
  label: string;
  remark: string;
  isPassing: boolean;
}> = [
  { minPercentage: 0, label: "F", remark: "Fail", isPassing: false },
  { minPercentage: 40, label: "D", remark: "Pass", isPassing: true },
  { minPercentage: 50, label: "C", remark: "Credit", isPassing: true },
  { minPercentage: 60, label: "B", remark: "Good", isPassing: true },
  { minPercentage: 70, label: "A", remark: "Very Good", isPassing: true },
  { minPercentage: 80, label: "A+", remark: "Excellent", isPassing: true },
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.PROVISIONING_SECRET;
  const provided = request.headers.get("x-provision-secret");
  if (!expected || provided !== expected) {
    return json({ ok: false, error: "Unauthorized." }, 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const admin = createSupabaseAdminClient();

  // 1. Create the school.
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ name: parsed.schoolName, code: parsed.schoolCode })
    .select("id, name, code")
    .single<{ id: string; name: string; code: string }>();

  if (schoolError || !school) {
    if (schoolError?.code === "23505") {
      return json(
        { ok: false, error: "That school code is already in use." },
        409,
      );
    }
    return json({ ok: false, error: "The school could not be created." }, 500);
  }

  // 2. Create the administrator's Auth account (verified, with a password).
  const { data: userData, error: userError } =
    await admin.auth.admin.createUser({
      email: parsed.adminEmail,
      password: parsed.adminPassword,
      email_confirm: true,
      app_metadata: { provisioned_by: "school-platform" },
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
    // Bands are convenience data; a failure here is not fatal to provisioning,
    // but we report it so the caller can retry the seeding step.
    return json(
      {
        ok: true,
        school: { id: school.id, name: school.name, code: school.code },
        admin: { email: parsed.adminEmail, userId },
        warning:
          "The school and administrator were created, but the default grade bands could not be seeded.",
      },
      201,
    );
  }

  return json(
    {
      ok: true,
      school: { id: school.id, name: school.name, code: school.code },
      admin: { email: parsed.adminEmail, userId },
    },
    201,
  );
}
