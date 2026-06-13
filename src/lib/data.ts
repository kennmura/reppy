import { unstable_noStore as noStore } from "next/cache";
import { kenProfile } from "./ken";
import { createSupabaseAdminClient, hasSupabaseConfig } from "./supabase";
import type {
  Coach,
  CoachApplication,
  CoachAudience,
  CoachProfileData,
  CoachService,
  CoachTestimonial,
  ConversationSafeMetadata,
  ConversationThread,
  Message,
  PlayerRecord,
  TrainingRequest,
} from "./types";

function sortByOrder<T extends { sort_order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

const publicCoachSelect = [
  "id",
  "user_id",
  "slug",
  "full_name",
  "sport",
  "category",
  "headline",
  "bio",
  "location",
  "service_area",
  "pricing_text",
  "profile_photo_url",
  "banner_image_url",
  "is_published",
  "is_featured",
  "accepting_requests",
  "profile_status",
  "founding_price_locked",
  "contact_scan_status",
  "admin_premium_access_until",
  "subscription_status",
  "created_at",
  "updated_at",
].join(", ");

export async function getCoachProfileBySlug(slug: string): Promise<CoachProfileData | null> {
  noStore();

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return slug === kenProfile.coach.slug ? kenProfile : null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: coach } = await supabase
    .from("coaches")
    .select(publicCoachSelect)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle<Coach>();

  if (!coach) {
    return slug === kenProfile.coach.slug ? kenProfile : null;
  }

  const [{ data: services }, { data: audiences }, { data: testimonials }] =
    await Promise.all([
      supabase.from("coach_services").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase.from("coach_audiences").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase
        .from("coach_testimonials")
        .select("*")
        .eq("coach_id", coach.id)
        .order("sort_order"),
    ]);

  return {
    coach,
    services: sortByOrder((services ?? []) as CoachService[]),
    audiences: sortByOrder((audiences ?? []) as CoachAudience[]),
    testimonials: sortByOrder((testimonials ?? []) as CoachTestimonial[]),
  };
}

export async function getPublishedCoaches(): Promise<Coach[]> {
  noStore();

  if (!hasSupabaseConfig() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return [kenProfile.coach];
  }

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("coaches")
    .select(publicCoachSelect)
    .eq("is_published", true)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: true });

  const coaches = (data ?? []) as unknown as Coach[];
  return coaches.length ? coaches : [kenProfile.coach];
}

export async function getAdminTrainingRequests(): Promise<TrainingRequest[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("training_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TrainingRequest[];
}

export async function getAdminCoaches(): Promise<Coach[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Coach[];
}

export async function getAdminCoachById(id: string): Promise<Coach | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coaches")
    .select("*")
    .eq("id", id)
    .maybeSingle<Coach>();

  if (error) {
    throw error;
  }

  return data;
}

export async function getAdminCoachProfileById(id: string): Promise<CoachProfileData | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data: coach, error } = await supabase
    .from("coaches")
    .select("*")
    .eq("id", id)
    .maybeSingle<Coach>();

  if (error) {
    throw error;
  }

  if (!coach) {
    return null;
  }

  const [{ data: services }, { data: audiences }, { data: testimonials }] =
    await Promise.all([
      supabase.from("coach_services").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase.from("coach_audiences").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase
        .from("coach_testimonials")
        .select("*")
        .eq("coach_id", coach.id)
        .order("sort_order"),
    ]);

  return {
    coach,
    services: sortByOrder((services ?? []) as CoachService[]),
    audiences: sortByOrder((audiences ?? []) as CoachAudience[]),
    testimonials: sortByOrder((testimonials ?? []) as CoachTestimonial[]),
  };
}

export async function getAdminCoachApplications(): Promise<CoachApplication[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coach_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as CoachApplication[];
}

export async function getCoachConversations({
  coachId,
  status,
}: {
  coachId: string;
  status?: string;
}): Promise<ConversationSafeMetadata[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("conversations")
    .select(
      "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
    )
    .eq("coach_id", coachId)
    .order("last_message_at", { ascending: false });

  if (status === "unread") {
    query = query.eq("is_unread_by_coach", true);
  } else if (status && status !== "inbox") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data ?? []) as ConversationSafeMetadata[];
}

export async function getCoachUnreadCount(coachId: string): Promise<number> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", coachId)
    .eq("is_unread_by_coach", true);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getCoachConversationThread({
  coachId,
  conversationId,
  includePrivate,
}: {
  coachId: string;
  conversationId: string;
  includePrivate: boolean;
}): Promise<ConversationThread | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
    )
    .eq("id", conversationId)
    .eq("coach_id", coachId)
    .maybeSingle<ConversationSafeMetadata>();

  if (error) {
    throw error;
  }

  if (!conversation) {
    return null;
  }

  if (!includePrivate) {
    return {
      conversation,
      privateDetails: null,
      messages: [],
    };
  }

  const [{ data: privateDetails }, { data: messages }] = await Promise.all([
    supabase
      .from("conversation_private_details")
      .select("conversation_id, requester_display_name, guardian_name, preferred_days_times, current_level")
      .eq("conversation_id", conversationId)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  return {
    conversation,
    privateDetails: privateDetails ?? null,
    messages: (messages ?? []) as Message[],
  };
}

export async function getCoachPlayerRecords(coachId: string): Promise<PlayerRecord[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("player_records")
    .select("*")
    .eq("coach_id", coachId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlayerRecord[];
}
