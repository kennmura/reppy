import { unstable_noStore as noStore } from "next/cache";
import { kenProfile } from "./ken";
import {
  coachSearchRadiusMiles,
  geocodeLocationInput,
  haversineMiles,
  isMissingCoachLocationColumnError,
  isValidCoordinates,
  normalizeLocationInput,
} from "./location";
import { sportMatches } from "./sports";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "./supabase";
import type {
  AccountPrivateDetails,
  AdminAccountDetail,
  AdminAccountSummary,
  AdminAuthUserSummary,
  Coach,
  CoachApplication,
  CoachAudience,
  CoachAvailabilityBlock,
  CoachCredential,
  CoachProfileData,
  CoachService,
  CoachTestimonial,
  ConversationSafeMetadata,
  ConversationThread,
  Message,
  PremiumAccessGrant,
  PlayerRecord,
  SavedCoach,
  Subscription,
  TrainingRequest,
  TrainingRequestBundle,
  TrainingRequestPayment,
  TrainingSession,
  UserCoachingPreference,
  UserProfile,
} from "./types";

function sortByOrder<T extends { sort_order: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

const playerAccountRoles = ["parent", "adult_player"] as const;

function isMissingAvailabilityTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.message?.includes("coach_availability_blocks");
}

function isMissingColumnError(error: { code?: string; message?: string; details?: string }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return error.code === "PGRST204" || /(column|schema cache|not find)/i.test(text);
}

function isMissingTableError(error: { code?: string; message?: string; details?: string }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return error.code === "42P01" || /does not exist|schema cache|not find/i.test(text);
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
  "public_location",
  "city",
  "state",
  "zip_code",
  "latitude",
  "longitude",
  "service_radius_miles",
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
  "coach_direct_preferred",
  "platform_payment_allowed",
  "platform_payment_required",
  "stripe_connected_account_id",
  "subscription_status",
  "created_at",
  "updated_at",
];
const legacyPublicCoachBaseFields = publicCoachBaseFields.filter(
  (field) =>
    ![
      "city",
      "state",
      "zip_code",
      "latitude",
      "longitude",
      "public_location",
      "service_radius_miles",
    ].includes(field),
);
const publicCoachSelect = publicCoachBaseFields.join(", ");
const legacyPublicCoachSelect = legacyPublicCoachBaseFields.join(", ");

function coachLocationText(coach: Coach) {
  return [
    coach.public_location,
    [coach.city, coach.state].filter(Boolean).join(", "),
    coach.zip_code,
    coach.location,
    coach.service_area,
  ]
    .filter(Boolean)
    .join(" ");
}

function coachMatchesLocationText(coach: Coach, location: string) {
  const normalizedNeedle = normalizeLocationInput(location);
  const zipNeedle = location.match(/\b\d{5}(?:-\d{4})?\b/)?.[0].slice(0, 5) ?? "";
  if (!normalizedNeedle && !zipNeedle) {
    return true;
  }

  const normalizedHaystack = normalizeLocationInput(coachLocationText(coach));
  return Boolean(
    (zipNeedle && normalizedHaystack.includes(zipNeedle)) ||
      (normalizedNeedle && normalizedHaystack.includes(normalizedNeedle)),
  );
}

function filterAndSortByLocation(coaches: Coach[], location?: string | null) {
  const cleanLocation = location?.trim();
  const origin = cleanLocation ? geocodeLocationInput(cleanLocation) : null;
  if (!cleanLocation) {
    return coaches;
  }

  if (!origin) {
    const textMatches = coaches.filter((coach) => coachMatchesLocationText(coach, cleanLocation));
    console.info("[coach search] Location input could not be geocoded; using text matches only", {
      location: cleanLocation,
      matchCount: textMatches.length,
    });
    return textMatches;
  }

  return coaches
    .map((coach) => {
      const coachCoordinates = isValidCoordinates(coach) ? coach : geocodeLocationInput(coachLocationText(coach));

      if (!coachCoordinates) {
        console.info("[coach search] Coach has no usable coordinates for location search", {
          coachId: coach.id,
          location: coachLocationText(coach),
        });
        return null;
      }

      return {
        ...coach,
        distance_miles: haversineMiles(origin, coachCoordinates),
      };
    })
    .filter((coach): coach is Coach & { distance_miles: number } =>
      Boolean(coach && coach.distance_miles <= coachSearchRadiusMiles(coach.service_radius_miles)),
    )
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

function trainingTypeTerms(trainingType?: string | null) {
  switch (trainingType) {
    case "private":
      return ["private", "1 on 1", "1-on-1", "one on one", "one-on-one", "individual"];
    case "small-group":
      return ["small group", "small-group", "group", "clinic", "clinics"];
    case "college-guidance":
      return ["college", "recruiting", "recruit", "guidance", "prep"];
    default:
      return [];
  }
}

function coachMatchesTrainingType(coach: Coach, trainingType?: string | null, services: CoachService[] = []) {
  const terms = trainingTypeTerms(trainingType);
  if (!terms.length) {
    return true;
  }

  const text = [
    coach.headline,
    coach.bio,
    coach.category,
    coach.training_format,
    coach.training_approach,
    coach.skill_levels,
    coach.positions,
    ...services.flatMap((service) => [service.title, service.description, service.format, service.level]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return terms.some((term) => text.includes(term));
}

async function filterCoachesByTrainingType(coaches: Coach[], trainingType?: string | null) {
  if (!trainingType || !coaches.length || !hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return coaches.filter((coach) =>
      coachMatchesTrainingType(
        coach,
        trainingType,
        coach.id === kenProfile.coach.id ? kenProfile.services : [],
      ),
    );
  }

  const supabase = createSupabaseAdminClient();
  const coachIds = coaches.map((coach) => coach.id);
  const { data } = await supabase
    .from("coach_services")
    .select("id, coach_id, title, description, duration, price, format, level, sort_order, created_at, updated_at")
    .in("coach_id", coachIds);
  const servicesByCoach = new Map<string, CoachService[]>();

  for (const service of (data ?? []) as CoachService[]) {
    const existing = servicesByCoach.get(service.coach_id) ?? [];
    existing.push(service);
    servicesByCoach.set(service.coach_id, existing);
  }

  return coaches.filter((coach) => coachMatchesTrainingType(coach, trainingType, servicesByCoach.get(coach.id) ?? []));
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

  const [{ data: services }, { data: audiences }, { data: testimonials }, { data: credentials }, availabilityBlocks] =
    await Promise.all([
      supabase.from("coach_services").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase.from("coach_audiences").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase
        .from("coach_testimonials")
        .select("*")
        .eq("coach_id", coach.id)
        .order("sort_order"),
      supabase.from("coach_credentials").select("*").eq("coach_id", coach.id).order("sort_order"),
      getCoachAvailabilityBlocks(coach.id),
    ]);

  return {
    coach,
    services: sortByOrder((services ?? []) as CoachService[]),
    audiences: sortByOrder((audiences ?? []) as CoachAudience[]),
    testimonials: sortByOrder((testimonials ?? []) as CoachTestimonial[]),
    credentials: sortByOrder((credentials ?? []) as CoachCredential[]),
    availabilityBlocks,
  };
}

async function getCoachProfileByCoach(coach: Coach): Promise<CoachProfileData> {
  const supabase = createSupabaseAdminClient();
  const [{ data: services }, { data: audiences }, { data: testimonials }, { data: credentials }, availabilityBlocks] =
    await Promise.all([
      supabase.from("coach_services").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase.from("coach_audiences").select("*").eq("coach_id", coach.id).order("sort_order"),
      supabase
        .from("coach_testimonials")
        .select("*")
        .eq("coach_id", coach.id)
        .order("sort_order"),
      supabase.from("coach_credentials").select("*").eq("coach_id", coach.id).order("sort_order"),
      getCoachAvailabilityBlocks(coach.id),
    ]);

  return {
    coach,
    services: sortByOrder((services ?? []) as CoachService[]),
    audiences: sortByOrder((audiences ?? []) as CoachAudience[]),
    testimonials: sortByOrder((testimonials ?? []) as CoachTestimonial[]),
    credentials: sortByOrder((credentials ?? []) as CoachCredential[]),
    availabilityBlocks,
  };
}

export async function getPublishedCoaches({
  sport,
  location,
  trainingType,
}: {
  sport?: string | null;
  location?: string | null;
  trainingType?: string | null;
} = {}): Promise<Coach[]> {
  noStore();

  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    const coaches = sportMatches(kenProfile.coach.sport, sport ?? null) ? [kenProfile.coach] : [];
    const trainingMatches = await filterCoachesByTrainingType(coaches, trainingType);
    return filterAndSortByLocation(trainingMatches, location);
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
  const trainingFilteredCoaches = await filterCoachesByTrainingType(coaches, trainingType);
  const locationFilteredCoaches = filterAndSortByLocation(trainingFilteredCoaches, location);

  if (trainingFilteredCoaches.length) {
    return locationFilteredCoaches;
  }

  const fallbackCoaches = sportMatches(kenProfile.coach.sport, sport ?? null) ? [kenProfile.coach] : [];
  const fallbackTrainingMatches = await filterCoachesByTrainingType(fallbackCoaches, trainingType);
  return filterAndSortByLocation(fallbackTrainingMatches, location);
}

export async function getSavedCoachIdsForUser(userId: string, coachIds?: string[]) {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase.from("saved_coaches").select("coach_id").eq("user_id", userId);

  if (coachIds?.length) {
    query = query.in("coach_id", coachIds);
  }

  const { data, error } = await query;
  if (error) {
    return [];
  }

  return (data ?? []).map((row) => row.coach_id as string);
}

export async function getSavedCoachesForUser(userId: string): Promise<Coach[]> {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data: saved, error: savedError } = await supabase
    .from("saved_coaches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (savedError || !saved?.length) {
    return [];
  }

  const savedRows = saved as SavedCoach[];
  const coachIds = savedRows.map((row) => row.coach_id);
  const { data: coaches, error: coachesError } = await supabase
    .from("coaches")
    .select(publicCoachSelect)
    .in("id", coachIds);

  if (coachesError) {
    return [];
  }

  const coachesById = new Map(((coaches ?? []) as unknown as Coach[]).map((coach) => [coach.id, coach]));
  return savedRows.map((row) => coachesById.get(row.coach_id)).filter((coach): coach is Coach => Boolean(coach));
}

export async function getAdminPremiumAccessGrants(): Promise<PremiumAccessGrant[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("premium_access_grants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return (data ?? []) as PremiumAccessGrant[];
}

export async function getAdminSubscriptions(): Promise<Subscription[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []) as Subscription[];
}

function compactAuthUser(user: unknown): AdminAuthUserSummary | null {
  if (!user || typeof user !== "object") {
    return null;
  }

  const record = user as Record<string, unknown>;
  const stringValue = (key: string) => (typeof record[key] === "string" ? record[key] : null);

  return {
    id: stringValue("id") ?? "",
    email: stringValue("email"),
    phone: stringValue("phone"),
    created_at: stringValue("created_at"),
    last_sign_in_at: stringValue("last_sign_in_at"),
    email_confirmed_at: stringValue("email_confirmed_at"),
    phone_confirmed_at: stringValue("phone_confirmed_at"),
  };
}

async function getAuthUsersById(userIds: string[]) {
  const supabase = createSupabaseAdminClient();
  const targetIds = new Set(userIds);
  const usersById = new Map<string, AdminAuthUserSummary>();

  if (!targetIds.size) {
    return usersById;
  }

  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) {
    return usersById;
  }

  for (const user of data.users) {
    if (targetIds.has(user.id)) {
      const compact = compactAuthUser(user);
      if (compact) {
        usersById.set(user.id, compact);
      }
    }
  }

  return usersById;
}

async function getAuthUserById(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error) {
    return null;
  }

  return compactAuthUser(data.user);
}

export async function getAdminPlayerAccounts(): Promise<AdminAccountSummary[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .in("role", [...playerAccountRoles])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const profiles = (data ?? []) as UserProfile[];
  const authUsersById = await getAuthUsersById(profiles.map((profile) => profile.id));

  return profiles.map((profile) => ({
    ...profile,
    auth_user: authUsersById.get(profile.id) ?? null,
  }));
}

export async function getAdminPlayerAccountById(userId: string): Promise<AdminAccountDetail | null> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .in("role", [...playerAccountRoles])
    .maybeSingle<UserProfile>();

  if (error) {
    throw error;
  }

  if (!profile) {
    return null;
  }

  const [{ data: privateDetails }, { data: preference }, conversations, savedCoaches, authUser] =
    await Promise.all([
      supabase
        .from("account_private_details")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle<AccountPrivateDetails>(),
      supabase
        .from("user_coaching_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle<UserCoachingPreference>(),
      getAccountConversations(userId),
      getSavedCoachesForUser(userId),
      getAuthUserById(userId),
    ]);

  return {
    profile,
    privateDetails: privateDetails ?? null,
    preference: preference ?? null,
    conversations,
    savedCoaches,
    authUser,
  };
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

export async function getAdminTrainingRequestPayments(): Promise<TrainingRequestPayment[]> {
  noStore();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("training_request_payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []) as TrainingRequestPayment[];
}

export async function getCoachTrainingRequests(coachId: string, limit = 8): Promise<TrainingRequest[]> {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("training_requests")
    .select("*")
    .eq("coach_id", coachId)
    .in("status", ["pending", "accepted_pending_payment", "paid_confirmed"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as TrainingRequest[];
}

export async function getTrainingRequestBundleByConversation(
  conversationId: string,
): Promise<TrainingRequestBundle> {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return { request: null, coach: null, payments: [], sessions: [] };
  }

  const supabase = createSupabaseAdminClient();
  const { data: request, error: requestError } = await supabase
    .from("training_requests")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<TrainingRequest>();

  if (requestError) {
    if (isMissingColumnError(requestError) || isMissingTableError(requestError)) {
      return { request: null, coach: null, payments: [], sessions: [] };
    }

    throw requestError;
  }

  if (!request) {
    return { request: null, coach: null, payments: [], sessions: [] };
  }

  const [
    { data: payments, error: paymentsError },
    { data: sessions, error: sessionsError },
    { data: coach, error: coachError },
  ] = await Promise.all([
    supabase
      .from("training_request_payments")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }),
    supabase
      .from("training_sessions")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }),
    request.coach_id
      ? supabase.from("coaches").select("*").eq("id", request.coach_id).maybeSingle<Coach>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (paymentsError && !isMissingTableError(paymentsError)) {
    throw paymentsError;
  }

  if (sessionsError && !isMissingTableError(sessionsError)) {
    throw sessionsError;
  }

  if (coachError) {
    throw coachError;
  }

  return {
    request,
    coach: coach ?? null,
    payments: (payments ?? []) as TrainingRequestPayment[],
    sessions: (sessions ?? []) as TrainingSession[],
  };
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

export async function getCoachAvailabilityBlocks(coachId: string): Promise<CoachAvailabilityBlock[]> {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("coach_availability_blocks")
    .select("*")
    .eq("coach_id", coachId)
    .order("availability_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    if (isMissingAvailabilityTableError(error)) {
      console.warn("[coach availability] coach_availability_blocks table is missing; returning no availability.");
      return [];
    }

    throw error;
  }

  return (data ?? []) as CoachAvailabilityBlock[];
}

export async function getCoachAvailabilityCount(coachId: string): Promise<number> {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return 0;
  }

  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("coach_availability_blocks")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", coachId);

  if (error) {
    if (isMissingAvailabilityTableError(error)) {
      console.warn("[coach availability] coach_availability_blocks table is missing; availability count is 0.");
      return 0;
    }

    throw error;
  }

  return count ?? 0;
}

export async function getCoachCalendarTrainingRequests(coachId: string): Promise<TrainingRequest[]> {
  noStore();
  if (!hasSupabaseConfig() || !hasSupabaseAdminConfig()) {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("training_requests")
    .select("*")
    .eq("coach_id", coachId)
    .not("requested_date", "is", null)
    .in("status", ["pending", "accepted_pending_payment", "paid_confirmed", "completed"])
    .order("requested_date", { ascending: true })
    .order("requested_start_time", { ascending: true });

  if (error) {
    if (isMissingColumnError(error)) {
      console.warn("[coach calendar] Training request schedule columns are missing; returning no calendar requests.");
      return [];
    }

    throw error;
  }

  return (data ?? []) as TrainingRequest[];
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
        .select(
          "conversation_id, requester_display_name, guardian_name, service_id, service_title, service_description, selected_availability_block_id, requested_date, requested_start_time, requested_end_time, timezone, player_age_at_request, preferred_days_times, current_level, current_team",
        )
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
