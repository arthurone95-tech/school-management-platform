import "server-only";

import type {
  AcademicEventSummary,
} from "@/lib/administration/types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type FailureReason = "not_found" | "duplicate" | "invalid" | "other";

export interface Failure {
  readonly ok: false;
  readonly reason: FailureReason;
  readonly message: string;
}

function classify(error: unknown): FailureReason {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "23505":
      return "duplicate";
    case "23514":
    case "23503":
      return "invalid";
    default:
      return "other";
  }
}

function failureMessage(reason: FailureReason, subject: string): string {
  switch (reason) {
    case "duplicate":
      return `${subject} with that name already exists.`;
    case "invalid":
      return `That ${subject.toLowerCase()} is not valid.`;
    case "not_found":
      return `The ${subject.toLowerCase()} could not be found.`;
    default:
      return `The ${subject.toLowerCase()} could not be saved.`;
  }
}

// ---------------------------------------------------------------------------
// Academic events
// ---------------------------------------------------------------------------

interface AcademicEventRow {
  readonly id: string;
  readonly term_id: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly event_type: string;
  readonly starts_on: string;
  readonly ends_on: string;
}

function toAcademicEvent(row: AcademicEventRow): AcademicEventSummary {
  return {
    id: row.id,
    termId: row.term_id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
  };
}

export async function listAcademicEvents(
  supabase: ServerClient,
  schoolId: string,
  termId: string | null,
): Promise<AcademicEventSummary[] | null> {
  let query = supabase
    .from("academic_events")
    .select("id, term_id, title, description, event_type, starts_on, ends_on")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: true });

  if (termId !== null) {
    query = query.eq("term_id", termId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return null;
  }
  return (data as AcademicEventRow[]).map(toAcademicEvent);
}

export async function createAcademicEvent(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly termId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly eventType: string;
  readonly startsOn: string;
  readonly endsOn: string;
}): Promise<
  | { readonly ok: true; readonly event: AcademicEventSummary }
  | { readonly ok: false; readonly reason: FailureReason; readonly message: string }
> {
  const { data, error } = await input.supabase
    .from("academic_events")
    .insert({
      school_id: input.schoolId,
      term_id: input.termId,
      title: input.title,
      description: input.description,
      event_type: input.eventType,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .select("id, term_id, title, description, event_type, starts_on, ends_on")
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return {
      ok: false,
      reason,
      message: failureMessage(reason, "Academic event"),
    };
  }
  return { ok: true, event: toAcademicEvent(data as AcademicEventRow) };
}

export async function updateAcademicEvent(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly eventId: string;
  readonly termId?: string | null;
  readonly title?: string;
  readonly description?: string | null;
  readonly eventType?: string;
  readonly startsOn?: string;
  readonly endsOn?: string;
}): Promise<
  | { readonly ok: true; readonly event: AcademicEventSummary }
  | { readonly ok: false; readonly reason: FailureReason; readonly message: string }
> {
  const { supabase, schoolId, eventId } = input;
  const patch: Record<string, unknown> = {};
  if (input.termId !== undefined) patch.term_id = input.termId;
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.eventType !== undefined) patch.event_type = input.eventType;
  if (input.startsOn !== undefined) patch.starts_on = input.startsOn;
  if (input.endsOn !== undefined) patch.ends_on = input.endsOn;

  const { data, error } = await supabase
    .from("academic_events")
    .update(patch)
    .eq("id", eventId)
    .eq("school_id", schoolId)
    .select("id, term_id, title, description, event_type, starts_on, ends_on")
    .maybeSingle();

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Academic event") };
  }
  if (!data) {
    return { ok: false, reason: "not_found", message: failureMessage("not_found", "Academic event") };
  }
  return { ok: true, event: toAcademicEvent(data as AcademicEventRow) };
}

export async function deleteAcademicEvent(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly eventId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: FailureReason; readonly message: string }> {
  const { error } = await input.supabase
    .from("academic_events")
    .delete()
    .eq("id", input.eventId)
    .eq("school_id", input.schoolId);

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Academic event") };
  }
  return { ok: true };
}
