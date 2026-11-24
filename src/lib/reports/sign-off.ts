import type { ReportCardSignOffSnapshot } from "@/lib/administration/types";

type RawSnapshot = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Normalises the report-card API row into the camelCase component shape. */
export function readSignOffSnapshot(value: unknown): ReportCardSignOffSnapshot | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as RawSnapshot;
  const status = row["status"] === "confirmed" ? "confirmed" : "draft";
  const mode = row["sign_off_mode"];
  return {
    status,
    headmasterRemark: text(row["headmaster_remark"]),
    headmasterSignatureUrl: text(row["headmaster_signature_url"]),
    signOffMode:
      mode === "image" || mode === "stamp" || mode === "draw" ? mode : null,
    signatoryName: text(row["signatory_name"]),
    signatoryTitle: text(row["signatory_title"]),
    signatureAssetUrl: text(row["signature_asset_url"]),
    confirmedAt: text(row["confirmed_at"]),
  };
}
