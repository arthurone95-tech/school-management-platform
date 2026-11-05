import "server-only";

import type {
  ExamScheduleSummary,
  ExamTimetableSlotSummary,
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
// Exam schedules
// ---------------------------------------------------------------------------

interface ExamScheduleRow {
  readonly id: string;
  readonly term_id: string;
  readonly name: string;
  readonly starts_on: string;
  readonly ends_on: string;
  readonly status: string;
}

function toExamSchedule(row: ExamScheduleRow): ExamScheduleSummary {
  return {
    id: row.id,
    termId: row.term_id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
  };
}

export async function listExamSchedules(
  supabase: ServerClient,
  schoolId: string,
  termId: string | null,
): Promise<ExamScheduleSummary[] | null> {
  let query = supabase
    .from("exam_schedules")
    .select("id, term_id, name, starts_on, ends_on, status")
    .eq("school_id", schoolId)
    .order("starts_on", { ascending: true });

  if (termId !== null) {
    query = query.eq("term_id", termId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return null;
  }
  return (data as ExamScheduleRow[]).map(toExamSchedule);
}

export async function createExamSchedule(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly termId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
}): Promise<
  | { readonly ok: true; readonly schedule: ExamScheduleSummary }
  | { readonly ok: false; readonly reason: FailureReason; readonly message: string }
> {
  const { data, error } = await input.supabase
    .from("exam_schedules")
    .insert({
      school_id: input.schoolId,
      term_id: input.termId,
      name: input.name,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
    })
    .select("id, term_id, name, starts_on, ends_on, status")
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return {
      ok: false,
      reason,
      message: failureMessage(reason, "Exam schedule"),
    };
  }
  return { ok: true, schedule: toExamSchedule(data as ExamScheduleRow) };
}

export async function updateExamSchedule(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly scheduleId: string;
  readonly name?: string;
  readonly startsOn?: string;
  readonly endsOn?: string;
  readonly status?: string;
}): Promise<
  | { readonly ok: true; readonly schedule: ExamScheduleSummary }
  | { readonly ok: false; readonly reason: FailureReason; readonly message: string }
> {
  const { supabase, schoolId, scheduleId } = input;
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.startsOn !== undefined) patch.starts_on = input.startsOn;
  if (input.endsOn !== undefined) patch.ends_on = input.endsOn;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from("exam_schedules")
    .update(patch)
    .eq("id", scheduleId)
    .eq("school_id", schoolId)
    .select("id, term_id, name, starts_on, ends_on, status")
    .maybeSingle();

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Exam schedule") };
  }
  if (!data) {
    return { ok: false, reason: "not_found", message: failureMessage("not_found", "Exam schedule") };
  }
  return { ok: true, schedule: toExamSchedule(data as ExamScheduleRow) };
}

export async function deleteExamSchedule(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly scheduleId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: FailureReason; readonly message: string }> {
  const { error } = await input.supabase
    .from("exam_schedules")
    .delete()
    .eq("id", input.scheduleId)
    .eq("school_id", input.schoolId);

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Exam schedule") };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Exam timetable slots
// ---------------------------------------------------------------------------

interface ExamTimetableSlotRow {
  readonly id: string;
  readonly exam_schedule_id: string;
  readonly subject_id: string;
  readonly subject_name: string | null;
  readonly class_id: string;
  readonly class_name: string | null;
  readonly exam_date: string;
  readonly start_time: string;
  readonly end_time: string;
  readonly room_name: string | null;
  readonly supervisor_id: string | null;
}

function toExamTimetableSlot(row: ExamTimetableSlotRow): ExamTimetableSlotSummary {
  return {
    id: row.id,
    examScheduleId: row.exam_schedule_id,
    subjectId: row.subject_id,
    subjectName: row.subject_name,
    classId: row.class_id,
    className: row.class_name,
    examDate: row.exam_date,
    startTime: row.start_time,
    endTime: row.end_time,
    roomName: row.room_name,
    supervisorId: row.supervisor_id,
  };
}

export async function listExamTimetableSlots(
  supabase: ServerClient,
  schoolId: string,
  examScheduleId: string,
): Promise<ExamTimetableSlotSummary[] | null> {
  const { data, error } = await supabase
    .from("exam_timetable_slots")
    .select(
      "id, exam_schedule_id, subject_id, subjects ( name ), class_id, classes ( name ), exam_date, start_time, end_time, room_name, supervisor_id",
    )
    .eq("school_id", schoolId)
    .eq("exam_schedule_id", examScheduleId)
    .order("exam_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error || !data) {
    return null;
  }
  return (data as unknown as ExamTimetableSlotRow[]).map(toExamTimetableSlot);
}

export async function createExamTimetableSlot(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly examScheduleId: string;
  readonly subjectId: string;
  readonly classId: string;
  readonly examDate: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly roomName: string | null;
  readonly supervisorId: string | null;
}): Promise<
  | { readonly ok: true; readonly slot: ExamTimetableSlotSummary }
  | { readonly ok: false; readonly reason: FailureReason; readonly message: string }
> {
  // Check for room/supervisor overlap
  if (input.roomName !== null) {
    const { data: roomConflict } = await input.supabase
      .from("exam_timetable_slots")
      .select("id")
      .eq("school_id", input.schoolId)
      .eq("exam_date", input.examDate)
      .eq("room_name", input.roomName)
      .lt("start_time", input.endTime)
      .gt("end_time", input.startTime)
      .limit(1);

    if (roomConflict && roomConflict.length > 0) {
      return {
        ok: false,
        reason: "duplicate",
        message: "This room is already booked for that time slot.",
      };
    }
  }

  if (input.supervisorId !== null) {
    const { data: supervisorConflict } = await input.supabase
      .from("exam_timetable_slots")
      .select("id")
      .eq("school_id", input.schoolId)
      .eq("exam_date", input.examDate)
      .eq("supervisor_id", input.supervisorId)
      .lt("start_time", input.endTime)
      .gt("end_time", input.startTime)
      .limit(1);

    if (supervisorConflict && supervisorConflict.length > 0) {
      return {
        ok: false,
        reason: "duplicate",
        message: "This supervisor is already assigned for that time slot.",
      };
    }
  }

  const { data, error } = await input.supabase
    .from("exam_timetable_slots")
    .insert({
      school_id: input.schoolId,
      exam_schedule_id: input.examScheduleId,
      subject_id: input.subjectId,
      class_id: input.classId,
      exam_date: input.examDate,
      start_time: input.startTime,
      end_time: input.endTime,
      room_name: input.roomName,
      supervisor_id: input.supervisorId,
    })
    .select(
      "id, exam_schedule_id, subject_id, subjects ( name ), class_id, classes ( name ), exam_date, start_time, end_time, room_name, supervisor_id",
    )
    .maybeSingle();

  if (error || !data) {
    const reason = classify(error);
    return {
      ok: false,
      reason,
      message: failureMessage(reason, "Exam timetable slot"),
    };
  }
  return { ok: true, slot: toExamTimetableSlot(data as unknown as ExamTimetableSlotRow) };
}

export async function deleteExamTimetableSlot(input: {
  readonly supabase: ServerClient;
  readonly schoolId: string;
  readonly slotId: string;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: FailureReason; readonly message: string }> {
  const { error } = await input.supabase
    .from("exam_timetable_slots")
    .delete()
    .eq("id", input.slotId)
    .eq("school_id", input.schoolId);

  if (error) {
    const reason = classify(error);
    return { ok: false, reason, message: failureMessage(reason, "Exam timetable slot") };
  }
  return { ok: true };
}
