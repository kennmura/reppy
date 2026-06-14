import { unstable_noStore as noStore } from "next/cache";
import { kenProfile } from "./ken";
import {
  geocodeLocationInput,
  haversineMiles,
  isMissingCoachLocationColumnError,
  isValidCoordinates,
} from "./location";
import { sportMatches } from "./sports";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "./supabase";
import type {
  Coach,
  CoachApplication,
  CoachAudience,
  CoachCredential,
  CoachProfileData,
  CoachService,
  CoachTestimonial,
  ConversationSafeMetadata,
  ConversationThread,
  Message,
  PlayerRecord,
  TrainingRequest,
  UserCoachingPreference,
} from "./types";

function sortByOrder<T extends { sort_order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

const publicCoachBaseFields = [
  "id",
  "user_id",
  "slug",
  "full_name",
  "sport",
  "category",
  "headline",
  "bio",
  "playing_experience",
  "coaching_experience",
  "current_affiliation",
  "years_experience",
  "training_approach",
  "age_groups",
  "skill_levels",
  "positions",
  "training_format",
  "general_availability",
  "location",
  "city",
  "state",
  "zip_code",
  "latitude",
  "longitude",
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
];
const legacyPublicCoachBaseFields = publicCoachBaseFields.filter(
  (field) => !["city", "state", "zip_code", "latitude", "longitude"].includes(field),
);
const publicCoachSelect = publicCoachBaseFields.join(", ");
const legacyPublicCoachSelect = legacyPublicCoachBaseFields.join(", ");

function filterAndSortByLocation(coaches: Coach[], location?: string | null) {
  const origin = location ? geocodeLocationInput(location) : null;
  if (!origin) {
    return location ? [] : coaches;
  }

  return coaches
    .map((coach) => {
      const coachCoordinates = isValidCoordinates(coach)
        ? coach
        : geocodeLocationInput(coach.zip_code || coach.location || "");

      if (!coachCoordinates) {
        return null;
      }

      return {
        ...coach,
        distance_miles: haversineMiles(origin, coachCoordinates),
      };
    })
    .filter((coach): coach is Coach & { distance_miles: number } => Boolean(coach && coach.distance_miles <= 30))
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

export async function getCoachProfileBySlug(slug: string): Promise<CoachProfileData | null> {
  noStore();

  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return slug === kenProfile.coach.slug ? kenProfile : null;
  }

  const supabase = createSupabaseAdminClient();
  let { data: coach, error: coachError } = await supabase
    .from("coaches")
    .select(publicCoachSelect)
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle<Coach>();

  if (coachError && isMissingCoachLocationColumnError(coachError)) {
    const fallback = await supabase
      .from("coaches")
      .select(legacyPublicCoachSelect)
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle<Coach>();
    coach = fallback.data;
    coachError = fallback.error;
  }

  if (!coach) {
    return slug === kenProfile.coach.slug ? kenProfile : null;
  }

  const [{ data: services }, { data: audiences }, { data: testimonials }, { data: credentials }] =
    await Promise.all([
      supabase.from("coach_services").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase.from("coach_audiences").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase
        .from("coach_testimonials")
        .select("*")
        .eq("coach_id", coach.id)
        .order("sort_order"),
      supabase.from("coach_credentials").select("*").eq("coach_id", coach.id).order("sort_order"),
    ]);

  return {
    coach,
    services: sortByOrder((services ?? []) as CoachService[]),
    audiences: sortByOrder((audiences ?? []) as CoachAudience[]),
    testimonials: sortByOrder((testimonials ?? []) as CoachTestimonial[]),
    credentials: sortByOrder((credentials ?? []) as CoachCredential[]),
  };
}

async function getCoachProfileByCoach(coach: Coach): Promise<CoachProfileData> {
  const supabase = createSupabaseAdminClient();
  const [{ data: services }, { data: audiences }, { data: testimonials }, { data: credentials }] =
    await Promise.all([
      supabase.from("coach_services").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase.from("coach_audiences").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase
        .from("coach_testimonials")
        .select("*")
        .eq("coach_id", coach.id)
        .order("sort_order"),
      supabase.from("coach_credentials").select("*").eq("coach_id", coach.id).order("sort_order"),
    ]);

  return {
    coach,
    services: sortByOrder((services ?? []) as CoachService[]),
    audiences: sortByOrder((audiences ?? []) as CoachAudience[]),
    testimonials: sortByOrder((testimonials ?? []) as CoachTestimonial[]),
    credentials: sortByOrder((credentials ?? []) as CoachCredential[]),
  };
}

export async function getPublishedCoaches({
  sport,
  location,
}: {
  sport?: string | null;
  location?: string | null;
} = {}): Promise<Coach[]> {
  noStore();

  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    const coaches = sportMatches(kenProfile.coach.sport, sport ?? null) ? [kenProfile.coach] : [];
    return filterAndSortByLocation(coaches, location);
  }

  const supabase = createSupabaseAdminClient();
  const buildQuery = (select: string) => {
    let query = supabase
      .from("coaches")
      .select(select)
      .eq("is_published", true)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: true });

    if (sport) {
      query = query.ilike("sport", sport);
    }

    return query;
  };

  let { data, error } = await buildQuery(publicCoachSelect);
  if (error && isMissingCoachLocationColumnError(error)) {
    const fallback = await buildQuery(legacyPublicCoachSelect);
    data = fallback.data;
    error = fallback.error;
  }

  const coaches = ((data ?? []) as unknown as Coach[]).filter((coach) =>
    sportMatches(coach.sport, sport ?? null),
  );
  const locationFilteredCoaches = filterAndSortByLocation(coaches, location);

  if (coaches.length) {
    return locationFilteredCoaches;
  }

  const fallbackCoaches = sportMatches(kenProfile.coach.sport, sport ?? null) ? [kenProfile.coach] : [];
  return filterAndSortByLocation(fallbackCoaches, location);
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

  return getCoachProfileByCoach(coach);
}

export async function getCoachProfileByOwner(userId: string): Promise<CoachProfileData | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data: coach, error } = await supabase
    .from("coaches")
    .select("*")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<Coach>();

  if (error) {
    throw error;
  }

  if (!coach) {
    return null;
  }

  return getCoachProfileByCoach(coach);
}

export async function getUserCoachingPreference(userId: string): Promise<UserCoachingPreference | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_coaching_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<UserCoachingPreference>();

  if (error) {
    throw error;
  }

  return data;
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
  coachUserId,
  status,
}: {
  coachId: string;
  coachUserId?: string | null;
  status?: string;
}): Promise<ConversationSafeMetadata[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("conversations")
    .select(
      "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, retention_expires_at, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
    )
    .eq("coach_id", coachId)
    .order("last_message_at", { ascending: false });

  if (status === "saved") {
    query = query.eq("is_saved", true);
  } else if (status === "unread" && !coachUserId) {
    query = query.eq("is_unread_by_coach", true);
  } else if (status && status !== "inbox") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const conversations = (data ?? []) as ConversationSafeMetadata[];

  if (!coachUserId || !conversations.length) {
    return conversations;
  }

  const { data: participants } = await supabase
    .from("conversation_participants")
    .select("conversation_id, unread_count, is_archived")
    .eq("user_id", coachUserId)
    .eq("role", "coach")
    .in(
      "conversation_id",
      conversations.map((conversation) => conversation.id),
    );

  const participantsByConversation = new Map(
    (participants ?? []).map((participant) => [
      participant.conversation_id,
      {
        unreadCount: Number(participant.unread_count ?? 0),
        archived: Boolean(participant.is_archived),
      },
    ]),
  );

  const withParticipantState = conversations.map((conversation) => {
    const participant = participantsByConversation.get(conversation.id);
    return {
      ...conversation,
      participant_unread_count: participant?.unreadCount ?? (conversation.is_unread_by_coach ? 1 : 0),
      participant_archived: participant?.archived ?? false,
    };
  });

  if (status === "unread") {
    return withParticipantState.filter((conversation) => (conversation.participant_unread_count ?? 0) > 0);
  }

  if (status === "archived") {
    return withParticipantState.filter((conversation) => conversation.participant_archived);
  }

  return withParticipantState;
}

export async function getCoachUnreadCount(coachId: string, coachUserId?: string | null): Promise<number> {
  noStore();
  const supabase = createSupabaseAdminClient();

  if (coachUserId) {
    const { data, error } = await supabase
      .from("conversation_participants")
      .select("unread_count")
      .eq("user_id", coachUserId)
      .eq("role", "coach")
      .eq("is_archived", false);

    if (!error) {
      return (data ?? []).reduce((sum, participant) => sum + Number(participant.unread_count ?? 0), 0);
    }
  }

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
  coachUserId,
  conversationId,
  includePrivate,
}: {
  coachId: string;
  coachUserId?: string | null;
  conversationId: string;
  includePrivate: boolean;
}): Promise<ConversationThread | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, retention_expires_at, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
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

  if (coachUserId) {
    const now = new Date().toISOString();
    await supabase
      .from("conversation_participants")
      .update({ unread_count: 0, last_read_at: now, updated_at: now })
      .eq("conversation_id", conversationId)
      .eq("user_id", coachUserId)
      .eq("role", "coach")
      .gt("unread_count", 0);
    await supabase
      .from("conversations")
      .update({ is_unread_by_coach: false, updated_at: now })
      .eq("id", conversationId)
      .eq("coach_id", coachId)
      .eq("is_unread_by_coach", true);
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

export async function getAccountConversations(userId: string): Promise<ConversationSafeMetadata[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data: participants, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id, unread_count, is_archived")
    .eq("user_id", userId)
    .neq("role", "coach")
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const conversationIds = (participants ?? []).map((participant) => participant.conversation_id);

  if (!conversationIds.length) {
    return [];
  }

  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select(
      "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, retention_expires_at, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
    )
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false });

  if (conversationsError) {
    throw conversationsError;
  }

  const participantsByConversation = new Map(
    (participants ?? []).map((participant) => [
      participant.conversation_id,
      {
        unreadCount: Number(participant.unread_count ?? 0),
        archived: Boolean(participant.is_archived),
      },
    ]),
  );

  return ((conversations ?? []) as ConversationSafeMetadata[]).map((conversation) => {
    const participant = participantsByConversation.get(conversation.id);
    return {
      ...conversation,
      participant_unread_count: participant?.unreadCount ?? 0,
      participant_archived: participant?.archived ?? false,
    };
  });
}

export async function getAccountConversationThread({
  userId,
  conversationId,
}: {
  userId: string;
  conversationId: string;
}): Promise<ConversationThread | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data: participant } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .neq("role", "coach")
    .maybeSingle<{ conversation_id: string }>();

  if (!participant) {
    return null;
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      "id, coach_id, coach_user_id, sport, request_type, age_range, general_location, status, is_unread_by_coach, is_saved, retention_expires_at, parent_follow_up_sent_at, last_message_at, created_at, updated_at",
    )
    .eq("id", conversationId)
    .maybeSingle<ConversationSafeMetadata>();

  if (error) {
    throw error;
  }

  if (!conversation) {
    return null;
  }

  const now = new Date().toISOString();
  await supabase
    .from("conversation_participants")
    .update({ unread_count: 0, last_read_at: now, updated_at: now })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .gt("unread_count", 0);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  return {
    conversation,
    privateDetails: null,
    messages: (messages ?? []) as Message[],
  };
}
