import { redirect } from "next/navigation";
import { createSupabaseAdminClient, createSupabaseServerClient, hasSupabaseConfig } from "./supabase";
import type { Coach } from "./types";

export async function getAdminUserOrRedirect() {
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!adminEmail) {
    redirect("/admin/login?error=missing-admin-email");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user || data.user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect("/admin/login");
  }

  return data.user;
}

export async function getCoachContextOrRedirect() {
  if (!hasSupabaseConfig()) {
    redirect("/coach/login?error=missing-supabase");
  }

  const supabaseAuth = await createSupabaseServerClient();
  const { data } = await supabaseAuth.auth.getUser();

  if (!data.user) {
    redirect("/coach/login");
  }

  const supabase = createSupabaseAdminClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select("*")
    .or(`user_id.eq.${data.user.id},email.eq.${data.user.email ?? ""}`)
    .limit(1)
    .maybeSingle<Coach>();

  if (!coach) {
    redirect("/coach/login?error=no-coach-profile");
  }

  if (!coach.user_id) {
    await supabase.from("coaches").update({ user_id: data.user.id }).eq("id", coach.id);
    await supabase
      .from("conversations")
      .update({ coach_user_id: data.user.id })
      .eq("coach_id", coach.id)
      .is("coach_user_id", null);
    coach.user_id = data.user.id;
  }

  return {
    user: data.user,
    coach,
    coachUserId: coach.user_id ?? data.user.id,
  };
}
