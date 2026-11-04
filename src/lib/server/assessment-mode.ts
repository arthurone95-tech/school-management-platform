import "server-only";

import type { AssessmentMode } from "@/lib/school/assessment-mode";
import { isAssessmentMode } from "@/lib/school/assessment-mode";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * Reads the active assessment framework for a school on the caller's session
 * client. The `schools_select_members` policy limits the row to a school the
 * caller belongs to, so this cannot be pointed at another school.
 */
export async function getAssessmentMode(
  supabase: ServerClient,
  schoolId: string,
): Promise<AssessmentMode | null> {
  const { data, error } = await supabase
    .from("schools")
    .select("assessment_mode")
    .eq("id", schoolId)
    .maybeSingle<{ assessment_mode: string }>();

  if (error || !data || !isAssessmentMode(data.assessment_mode)) {
    return null;
  }
  return data.assessment_mode;
}
