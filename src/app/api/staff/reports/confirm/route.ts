import type { NextResponse } from "next/server";

import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function readNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

/** Returns the latest confirmed sign-off snapshot for a learner's report card. */
export async function GET(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "assessment.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  const learnerId = new URL(request.url).searchParams.get("learnerId");
  if (!isUuid(learnerId)) {
    return json({ ok: false, error: "Invalid learner." }, 400);
  }

  const { data, error } = await supabase
    .from("report_cards")
    .select(
      "id, status, headmaster_remark, headmaster_signature_url, sign_off_mode, signatory_name, signatory_title, signature_asset_url, confirmed_at",
    )
    .eq("school_id", access.schoolId)
    .eq("learner_id", learnerId.trim())
    .eq("status", "confirmed")
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return json({ ok: false, error: "The report card could not be loaded." }, 500);
  }

  return json({ ok: true, reportCard: data ?? null });
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "report.read");
  if (!access.ok) {
    return json({ ok: false, error: access.message }, access.status);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const record = body as Record<string, unknown>;

  const learnerId = record["learnerId"];
  const termId = record["termId"];
  if (!isUuid(learnerId) || !isUuid(termId)) {
    return json({ ok: false, error: "Invalid learner or term." }, 400);
  }

  const status = record["status"];
  if (status !== undefined && status !== "draft" && status !== "confirmed") {
    return json({ ok: false, error: "Invalid report status." }, 400);
  }

  const headmasterRemark =
    typeof record["headmasterRemark"] === "string"
      ? record["headmasterRemark"].trim() || null
      : record["headmasterRemark"] === null
        ? null
        : undefined;
  const headmasterSignatureUrl =
    typeof record["headmasterSignatureUrl"] === "string"
      ? record["headmasterSignatureUrl"].trim() || null
      : record["headmasterSignatureUrl"] === null
        ? null
        : undefined;

  const confirmed = status === "confirmed";

  const { data: learner } = await supabase
    .from("learners")
    .select("id")
    .eq("id", learnerId.trim())
    .eq("school_id", access.schoolId)
    .maybeSingle<{ id: string }>();

  if (!learner) {
    return json({ ok: false, error: "The learner could not be found." }, 404);
  }

  const { data: school } = await supabase
    .from("schools")
    .select(
      "sign_off_mode, headmaster_name, headmaster_title, headmaster_signature_url",
    )
    .eq("id", access.schoolId)
    .maybeSingle<{
      sign_off_mode: string | null;
      headmaster_name: string | null;
      headmaster_title: string | null;
      headmaster_signature_url: string | null;
    }>();

  const mode =
    school?.sign_off_mode === "image" ||
    school?.sign_off_mode === "stamp" ||
    school?.sign_off_mode === "draw"
      ? school.sign_off_mode
      : "image";
  const storeSignatureUrl =
    mode === "stamp" ? null : (school?.headmaster_signature_url ?? null);

  if (confirmed && mode !== "stamp" && !storeSignatureUrl) {
    return json(
      {
        ok: false,
        error: "Configure a headmaster signature before confirming report cards.",
      },
      400,
    );
  }

  const payload: Record<string, unknown> = {
    school_id: access.schoolId,
    learner_id: learnerId.trim(),
    term_id: termId.trim(),
    status: status ?? "draft",
  };

  if (headmasterRemark !== undefined) payload.headmaster_remark = headmasterRemark;
  if (!confirmed && headmasterSignatureUrl !== undefined) {
    payload.headmaster_signature_url = headmasterSignatureUrl;
  }
  if (confirmed) {
    payload.confirmed_by = access.userId;
    payload.confirmed_at = new Date().toISOString();
    payload.sign_off_mode = mode;
    payload.signatory_name = school?.headmaster_name ?? null;
    payload.signatory_title = school?.headmaster_title ?? null;
    payload.signature_asset_url = storeSignatureUrl;
    payload.headmaster_signature_url = storeSignatureUrl;
  }
  const feeArrears = readNumber(record["feeArrears"]);
  const nextTermFee = readNumber(record["nextTermFee"]);
  const totalBalance = readNumber(record["totalBalance"]);
  if (feeArrears !== undefined) payload.fee_arrears = feeArrears;
  if (nextTermFee !== undefined) payload.next_term_fee = nextTermFee;
  if (totalBalance !== undefined) payload.total_balance = totalBalance;

  const { data, error } = await supabase
    .from("report_cards")
    .upsert(payload, { onConflict: "school_id,learner_id,term_id" })
    .select(
      "id, status, headmaster_remark, headmaster_signature_url, sign_off_mode, signatory_name, signatory_title, signature_asset_url, confirmed_at",
    )
    .maybeSingle();

  if (error || !data) {
    return json(
      { ok: false, error: "The report card could not be confirmed." },
      500,
    );
  }

  return json({ ok: true, reportCard: data });
}
