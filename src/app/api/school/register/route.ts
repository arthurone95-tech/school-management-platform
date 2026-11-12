import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";

interface RegisterBody {
  readonly schoolName: string;
  readonly schoolCode: string;
  readonly adminEmail: string;
  readonly adminPassword: string;
}

/** School code pattern: consonants + digits, no vowels A E I O U */
const SCHOOL_CODE_RE = /^[A-HJ-NP-RT-Y0-9]{4,10}$/;

function parseBody(value: unknown): RegisterBody | null {
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
  if (typeof adminEmail !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
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

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 }
    );
  }

  const supabaseAdmin = createSupabaseAdminClient();

  // 1. Check if school code already exists
  const { data: existingSchool, error: checkError } = await supabaseAdmin
    .from("schools")
    .select("id, code")
    .eq("code", parsed.schoolCode)
    .maybeSingle();

  if (checkError) {
    return NextResponse.json(
      { ok: false, error: "Could not check school code availability." },
      { status: 500 }
    );
  }

  if (existingSchool) {
    return NextResponse.json(
      {
        ok: false,
        error: "That school code is already in use. Please choose another.",
      },
      { status: 409 }
    );
  }

  // 2. Create the school record
  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .insert({ name: parsed.schoolName, code: parsed.schoolCode })
    .select("id, name, code")
    .single<{ id: string; name: string; code: string }>();

  if (schoolError || !school) {
    return NextResponse.json(
      { ok: false, error: "The school could not be created." },
      { status: 500 }
    );
  }

  // 3. Create the administrator's Auth account (verified, with password)
  const { data: userData, error: userError } =
    await supabaseAdmin.auth.admin.createUser({
      email: parsed.adminEmail,
      password: parsed.adminPassword,
      email_confirm: true,
      app_metadata: { provisioned_by: "school-registration" },
    });

  if (userError || !userData.user) {
    // Best-effort cleanup: delete the school row we just created
    await supabaseAdmin.from("schools").delete().eq("id", school.id);
    const exists =
      userError?.code === "email_exists" ||
      userError?.code === "user_already_exists" ||
      userError?.message === "User already registered";
    return NextResponse.json(
      {
        ok: false,
        error: exists
          ? "That email already has an account. Please use a different email."
          : "The administrator account could not be created.",
      },
      exists ? { status: 409 } : { status: 500 }
    );
  }

  const userId = userData.user.id;

  // 4. Link the user to the school as an active school_administrator
  const { error: membershipError } = await supabaseAdmin.from("school_members").insert({
    school_id: school.id,
    user_id: userId,
    role: "school_administrator",
    status: "active",
  });

  if (membershipError) {
    // Cleanup: delete user and school
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await supabaseAdmin.from("schools").delete().eq("id", school.id);
    return NextResponse.json(
      { ok: false, error: "The membership could not be created." },
      { status: 500 }
    );
  }

  // 5. Return success with login information
  // The new admin can sign in immediately with their email/password
  // and also use the school code for student portal sign-in
  return NextResponse.json(
    {
      ok: true,
      school: { id: school.id, name: school.name, code: school.code },
      admin: { email: parsed.adminEmail, userId },
      instructions: {
        signInUrl: "/sign-in",
        method: "email_password",
        studentSignInMethod: "school_code + username + password",
      },
    },
    { status: 201 }
  );
}