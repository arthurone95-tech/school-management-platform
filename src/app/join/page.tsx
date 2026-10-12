import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { JoinForm } from "./join-form";

/**
 * Invitation acceptance page (D-024).
 *
 * Reached after the staff invitation email's single-use link is exchanged at
 * /auth/confirm, which confirms the email and establishes a session. This page
 * asks the invited staff member to choose a password; the first sign-in with
 * that password activates their school membership. Anyone without a session is
 * sent back to the landing page.
 */
export const instant = false;

export default async function JoinPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();

  if (error || !userData.user) {
    redirect("/?auth=required");
  }

  return <JoinForm email={userData.user.email ?? "you"} />;
}
