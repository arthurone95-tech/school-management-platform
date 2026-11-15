import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

interface CreateSchoolBody {
  readonly schoolName: string;
  readonly schoolCode: string;
}

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseBody(value: unknown): CreateSchoolBody | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const schoolName = record.schoolName;
  const schoolCode = record.schoolCode;

  if (
    typeof schoolName !== "string" ||
    schoolName.trim().length < 2 ||
    schoolName.trim().length > 120
  ) {
    return null;
  }
  if (typeof schoolCode !== "string") {
    return null;
  }
  // School code regex: letters A-H,J-N,P-R,T,Y and digits 0-9
  const SCHOOL_CODE_RE = /^[A-HJ-NP-RT-Y0-9]{4,10}$/;
  if (!SCHOOL_CODE_RE.test(schoolCode)) {
    return null;
  }

  return {
    schoolName: schoolName.trim(),
    schoolCode,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json();
  const parsed = parseBody(body);
  if (!parsed) {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const schoolName = parsed.schoolName;
  const schoolCode = parsed.schoolCode;

  // Use the admin client to create the school using existing logic
  const admin = createSupabaseAdminClient();

  // 1. Create the school.
  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ name: schoolName, code: schoolCode })
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
  // For the owner-created school, we'll use a generated password and show the details.
  const defaultPassword = "TempPass123!"; // In production, would be generated

  const { data: userData, error: userError } =
    await admin.auth.admin.createUser({
      email: `admin-${schoolCode}@schoolplatform.example`,
      password: defaultPassword,
      email_confirm: true,
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

  const { error: bandsError } = await admin.from("grade_bands").insert(
    DEFAULT_GRADE_BANDS.map((band) => ({
      school_id: school.id,
      min_percentage: band.minPercentage,
      label: band.label,
      remark: band.remark,
      is_passing: band.isPassing,
    }))
  );

  if (bandsError) {
    // Bands are convenience data; report success but warn.
    return json(
      {
        ok: true,
        school: { id: school.id, name: school.name, code: school.code },
        admin: {
          email: `admin-${schoolCode}@schoolplatform.example`,
          password: defaultPassword,
          userId,
        },
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
      admin: {
        email: `admin-${schoolCode}@schoolplatform.example`,
        password: defaultPassword,
        userId,
      },
    },
    201,
  );
}