import { randomUUID } from "node:crypto";

import type { NextResponse } from "next/server";

import { json } from "@/lib/server/http";
import { resolveSchoolAccess } from "@/lib/server/school-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DATA_URL_PATTERN =
  /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

function hasMagicBytes(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/png") {
    return bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  }
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createSupabaseServerClient();

  const access = await resolveSchoolAccess(supabase, "school.manage");
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

  const dataUrl = (body as Record<string, unknown>)["dataUrl"];
  if (typeof dataUrl !== "string") {
    return json({ ok: false, error: "A signature image is required." }, 400);
  }

  const match = DATA_URL_PATTERN.exec(dataUrl.trim());
  if (!match) {
    return json(
      { ok: false, error: "Use a PNG, JPEG, or WebP signature image." },
      400,
    );
  }

  const contentType = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    return json({ ok: false, error: "The signature must be 2 MB or smaller." }, 400);
  }
  if (!hasMagicBytes(bytes, contentType)) {
    return json({ ok: false, error: "The signature image is not valid." }, 400);
  }

  const extension = contentType === "image/jpeg" ? "jpg" : contentType.slice(6);
  const path = `${access.schoolId}/signature/${randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("school-assets")
    .upload(path, bytes, { contentType, upsert: true });

  if (uploadError) {
    return json({ ok: false, error: "The signature could not be uploaded." }, 500);
  }

  const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
  return json({ ok: true, url: data.publicUrl });
}
