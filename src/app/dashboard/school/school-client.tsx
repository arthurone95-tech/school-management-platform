"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TextField } from "@/components/ui/form";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseSchoolProfileUpdateInput } from "@/lib/administration/requests";
import type { SchoolProfile } from "@/lib/administration/types";
import { AssessmentModeToggle } from "./assessment-mode-toggle";

const NETWORK_MESSAGE =
  "We could not reach the server. Check your connection and try again.";

type PostResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string };

/** Posts JSON and normalises the API's `{ ok, error }` envelope. */
async function postJson(url: string, body: unknown): Promise<PostResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as {
    readonly ok?: boolean;
    readonly error?: string;
  };
  if (!response.ok || payload.ok !== true) {
    return {
      ok: false,
      message: payload.error ?? "The change could not be saved.",
    };
  }
  return { ok: true };
}

async function getJson<T>(
  url: string,
  pick: (payload: Record<string, unknown>) => T | null,
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return { ok: false, message: NETWORK_MESSAGE };
  }
  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const value = pick(payload);
  if (!response.ok || payload["ok"] !== true || value === null) {
    const error = payload["error"];
    return {
      ok: false,
      message:
        typeof error === "string" ? error : "The data could not be loaded.",
    };
  }
  return { ok: true, value };
}

export function SchoolClient({
  canManageSchool,
  canManageSubjects,
  canManageGrading,
}: {
  readonly canManageSchool: boolean;
  readonly canReadAcademic: boolean;
  readonly canManageAcademic: boolean;
  readonly canManageSubjects: boolean;
  readonly canManageGrading: boolean;
}) {
  const router = useRouter();

  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [physicalAddressDraft, setPhysicalAddressDraft] = useState("");
  const [primaryPhoneDraft, setPrimaryPhoneDraft] = useState("");
  const [secondaryPhoneDraft, setSecondaryPhoneDraft] = useState("");
  const [officialEmailDraft, setOfficialEmailDraft] = useState("");
  const [websiteDraft, setWebsiteDraft] = useState("");
  const [logoUrlDraft, setLogoUrlDraft] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!canManageSchool) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const result = await getJson(
        "/api/staff/school",
        (payload) => (payload["school"] as SchoolProfile | undefined) ?? null,
      );
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setProfileError(null);
        setProfile(result.value);
        setNameDraft(result.value.name);
        setPhysicalAddressDraft(result.value.physicalAddress ?? "");
        setPrimaryPhoneDraft(result.value.primaryPhone ?? "");
        setSecondaryPhoneDraft(result.value.secondaryPhone ?? "");
        setOfficialEmailDraft(result.value.officialEmail ?? "");
        setWebsiteDraft(result.value.website ?? "");
        setLogoUrlDraft(result.value.logoUrl ?? null);
      } else {
        setProfileError(result.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageSchool]);

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileNotice(null);

    const parsed = parseSchoolProfileUpdateInput({
      name: nameDraft,
      physicalAddress: physicalAddressDraft,
      primaryPhone: primaryPhoneDraft,
      secondaryPhone: secondaryPhoneDraft,
      officialEmail: officialEmailDraft,
      website: websiteDraft,
      logoUrl: logoUrlDraft,
    });
    if (!parsed.ok) {
      setProfileError(parsed.message);
      return;
    }

    setSavingProfile(true);
    const result = await postJson("/api/staff/school/update", parsed.value);
    setSavingProfile(false);
    if (!result.ok) {
      setProfileError(result.message);
      return;
    }
    setProfileNotice("School profile saved.");
    router.refresh();
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setProfileError("Choose an image file (PNG, JPEG, or WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileError("The logo must be 2 MB or smaller.");
      return;
    }

    setUploadingLogo(true);
    setProfileError(null);
    setProfileNotice(null);

    const supabase = createSupabaseBrowserClient();
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${profile.id}/logo/${Math.random().toString(36).slice(2)}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("school-assets")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploadingLogo(false);
      setProfileError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("school-assets").getPublicUrl(path);
    setLogoUrlDraft(data.publicUrl);

    const saveResult = await postJson("/api/staff/school/update", {
      name: nameDraft,
      physicalAddress: physicalAddressDraft,
      primaryPhone: primaryPhoneDraft,
      secondaryPhone: secondaryPhoneDraft,
      officialEmail: officialEmailDraft,
      website: websiteDraft,
      logoUrl: data.publicUrl,
    });

    setUploadingLogo(false);

    if (!saveResult.ok) {
      setProfileError(saveResult.message);
      return;
    }

    setProfileNotice("Logo uploaded and saved.");
  }

  const logoPreview = logoUrlDraft ?? profile?.logoUrl ?? null;

  return (
    <div className="container stack">
      <div className="stack stack--sm">
        <h1>School settings</h1>
        <p className="muted">
          Your school profile, branding, and assessment framework settings.
          Academic calendars and examinations are managed under the Academics tab.
        </p>
      </div>

      {/* School profile */}
      {canManageSchool ? (
        <Card>
          <CardHeader
            title="School profile"
            description="The school name is shown to your staff and students. The school code is fixed because students use it to sign in."
          />
          <CardBody className="stack stack--sm">
            {profileNotice ? (
              <Alert variant="success">{profileNotice}</Alert>
            ) : null}
            {profileError ? (
              <Alert variant="error">{profileError}</Alert>
            ) : null}
            {profile === null && profileError === null ? (
              <p className="muted" role="status">
                Loading school profile…
              </p>
            ) : (
              <form
                className="stack"
                onSubmit={handleSaveProfile}
                noValidate
              >
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="School logo preview"
                      style={{ width: 72, height: 72, objectFit: "contain", border: "1px solid var(--border)" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        border: "1px dashed var(--border)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--muted-foreground)",
                      }}
                    >
                      No logo
                    </div>
                  )}
                  <label className="btn btn--secondary btn--sm">
                    {uploadingLogo ? "Uploading..." : "Upload logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleLogoChange}
                      disabled={uploadingLogo}
                      style={{ display: "none" }}
                    />
                  </label>
                  {logoPreview ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setLogoUrlDraft(null);
                        setProfile((current) =>
                          current ? { ...current, logoUrl: null } : current,
                        );
                      }}
                    >
                      Remove logo
                    </Button>
                  ) : null}
                </div>

                <TextField
                  label="School name"
                  name="schoolName"
                  autoComplete="off"
                  required
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                />
                <TextField
                  label="Physical address"
                  name="physicalAddress"
                  value={physicalAddressDraft}
                  onChange={(event) => setPhysicalAddressDraft(event.target.value)}
                />
                <TextField
                  label="Primary phone"
                  name="primaryPhone"
                  value={primaryPhoneDraft}
                  onChange={(event) => setPrimaryPhoneDraft(event.target.value)}
                />
                <TextField
                  label="Secondary phone"
                  name="secondaryPhone"
                  value={secondaryPhoneDraft}
                  onChange={(event) => setSecondaryPhoneDraft(event.target.value)}
                />
                <TextField
                  label="Official email"
                  name="officialEmail"
                  type="email"
                  value={officialEmailDraft}
                  onChange={(event) => setOfficialEmailDraft(event.target.value)}
                />
                <TextField
                  label="Website"
                  name="website"
                  value={websiteDraft}
                  onChange={(event) => setWebsiteDraft(event.target.value)}
                />
                <Button type="submit" loading={savingProfile}>
                  {savingProfile ? "Saving..." : "Save profile"}
                </Button>
              </form>
            )}
            {profile !== null ? (
              <p className="record__meta">
                School code: <strong>{profile.code}</strong>
              </p>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <AssessmentModeToggle
        canManage={canManageSchool}
        canConfigure={canManageSubjects || canManageGrading}
      />
    </div>
  );
}