import { unstable_noStore as noStore } from "next/cache";
import { createSupabaseAdminClient, hasSupabaseAdminConfig, hasSupabaseConfig } from "./supabase";
import type {
  AccountPassportDashboard,
  AdminPassportDashboard,
  CoachPassportDashboard,
  CoachPassportTeamBundle,
  PassportContentReport,
  PassportRosterInvite,
  PassportTeam,
  PassportTeamMember,
  PlayerClip,
  PlayerClipComment,
  PlayerDevelopmentFocus,
  PlayerFeedbackComment,
  PlayerGameReflection,
  PlayerHandoffSummary,
  PlayerParentLink,
  PlayerProfile,
  PlayerProfileAccess,
  PlayerProfileEmail,
  PlayerTimelineEvent,
  PublicPlayerProfile,
  PassportPlayerBundle,
} from "./passportTypes";

function hasPassportConfig() {
  return hasSupabaseConfig() && hasSupabaseAdminConfig();
}

export function isMissingPassportTableError(error: { code?: string; message?: string; details?: string } | null) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  return error?.code === "42P01" || /does not exist|schema cache|not find/i.test(text);
}

export function normalizePassportEmail(value: FormDataEntryValue | string | null | undefined) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return email || null;
}

export function slugifyPassportName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function publicPlayerFields(profile: PlayerProfile, publicClips: PlayerClip[] = [], publicTimeline: PlayerTimelineEvent[] = []): PublicPlayerProfile {
  return {
    id: profile.id,
    slug: profile.slug,
    display_name: profile.display_name,
    profile_photo_url: profile.profile_photo_url,
    banner_image_url: profile.banner_image_url,
    sport: profile.sport,
    position: profile.position,
    secondary_positions: profile.secondary_positions ?? [],
    graduation_year: profile.graduation_year,
    current_team: profile.team_names_public ? profile.current_team : null,
    achievements: profile.achievements,
    strengths: profile.strengths,
    height: profile.height_public ? profile.height : null,
    bio: profile.bio,
    city: profile.location_public ? profile.city : null,
    state: profile.location_public ? profile.state : null,
    team_names_public: profile.team_names_public,
    height_public: profile.height_public,
    location_public: profile.location_public,
    created_at: profile.created_at,
    updated_at: profile.updated_at,
    publicClips,
    publicTimeline,
  };
}

export async function getPublicPlayerProfileBySlug(slug: string): Promise<PublicPlayerProfile | null> {
  noStore();
  if (!hasPassportConfig()) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("player_profiles")
    .select("*")
    .eq("slug", slug)
    .eq("visibility", "public")
    .eq("status", "active")
    .maybeSingle<PlayerProfile>();

  if (error) {
    if (isMissingPassportTableError(error)) {
      return null;
    }

    throw error;
  }

  if (!profile) {
    return null;
  }

  const [{ data: clips }, { data: timeline }] = await Promise.all([
    supabase
      .from("player_clips")
      .select("*")
      .eq("player_profile_id", profile.id)
      .eq("source", "player_upload")
      .eq("visibility", "public")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("player_development_timeline")
      .select("*")
      .eq("player_profile_id", profile.id)
      .eq("visibility", "public")
      .eq("status", "active")
      .order("occurred_at", { ascending: false })
      .limit(12),
  ]);

  return publicPlayerFields(profile, (clips ?? []) as PlayerClip[], (timeline ?? []) as PlayerTimelineEvent[]);
}

export async function canManagePlayerProfile(userId: string, playerId: string) {
  if (!hasPassportConfig()) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: profile }, { data: parentLink }] = await Promise.all([
    supabase
      .from("player_profiles")
      .select("id,user_id,created_by_user_id")
      .eq("id", playerId)
      .maybeSingle<Pick<PlayerProfile, "id" | "user_id" | "created_by_user_id">>(),
    supabase
      .from("player_profile_parent_links")
      .select("id")
      .eq("player_profile_id", playerId)
      .eq("parent_user_id", userId)
      .eq("status", "active")
      .maybeSingle<{ id: string }>(),
  ]);

  return Boolean(profile && (profile.user_id === userId || profile.created_by_user_id === userId || parentLink));
}

export async function canCoachAccessPlayer({
  coachUserId,
  playerId,
  teamId,
}: {
  coachUserId: string;
  playerId: string;
  teamId?: string | null;
}) {
  if (!hasPassportConfig()) {
    return false;
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("passport_team_members")
    .select("team_id")
    .eq("player_profile_id", playerId)
    .eq("member_role", "player")
    .eq("status", "active");

  if (teamId) {
    query = query.eq("team_id", teamId);
  }

  const { data: playerMemberships, error } = await query;
  if (error) {
    return false;
  }

  const teamIds = (playerMemberships ?? []).map((membership) => membership.team_id).filter(Boolean);
  if (!teamIds.length) {
    return false;
  }

  const [{ data: ownedTeams }, { data: staffMemberships }] = await Promise.all([
    supabase.from("passport_teams").select("id").eq("coach_user_id", coachUserId).in("id", teamIds),
    supabase
      .from("passport_team_members")
      .select("id")
      .eq("user_id", coachUserId)
      .in("team_id", teamIds)
      .in("member_role", ["head_coach", "assistant_coach", "support_coach"])
      .eq("status", "active"),
  ]);

  return Boolean((ownedTeams ?? []).length || (staffMemberships ?? []).length);
}

export async function getAccountPassportDashboard(userId: string, userEmail?: string | null): Promise<AccountPassportDashboard> {
  noStore();
  if (!hasPassportConfig()) {
    return { players: [], parentLinkedPlayers: [], invites: [] };
  }

  const supabase = createSupabaseAdminClient();
  const email = normalizePassportEmail(userEmail);
  const [{ data: players, error }, { data: parentLinks }, inviteResult] = await Promise.all([
    supabase
      .from("player_profiles")
      .select("*")
      .or(`user_id.eq.${userId},created_by_user_id.eq.${userId}`)
      .neq("status", "removed")
      .order("updated_at", { ascending: false }),
    supabase
      .from("player_profile_parent_links")
      .select("player_profile_id")
      .eq("parent_user_id", userId)
      .eq("status", "active"),
    email
      ? supabase
          .from("passport_roster_invites")
          .select("*")
          .or(
            `parent_email_normalized.eq.${email},player_school_email_normalized.eq.${email},player_personal_email_normalized.eq.${email}`,
          )
          .eq("status", "sent")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (error) {
    if (isMissingPassportTableError(error)) {
      return { players: [], parentLinkedPlayers: [], invites: [] };
    }

    throw error;
  }

  const linkedIds = (parentLinks ?? []).map((link) => link.player_profile_id);
  const { data: linkedPlayers } = linkedIds.length
    ? await supabase.from("player_profiles").select("*").in("id", linkedIds).neq("status", "removed")
    : { data: [] };

  return {
    players: (players ?? []) as PlayerProfile[],
    parentLinkedPlayers: (linkedPlayers ?? []) as PlayerProfile[],
    invites: (inviteResult.data ?? []) as PassportRosterInvite[],
  };
}

export async function getPlayerPassportBundle(playerId: string): Promise<PassportPlayerBundle | null> {
  noStore();
  if (!hasPassportConfig()) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: profile, error } = await supabase
    .from("player_profiles")
    .select("*")
    .eq("id", playerId)
    .neq("status", "removed")
    .maybeSingle<PlayerProfile>();

  if (error) {
    if (isMissingPassportTableError(error)) {
      return null;
    }

    throw error;
  }

  if (!profile) {
    return null;
  }

  const [
    { data: emails },
    { data: parentLinks },
    { data: memberships },
    { data: clips },
    { data: comments },
    { data: feedback },
    { data: focuses },
    { data: reflections },
    { data: handoffs },
    { data: accessGrants },
    { data: timeline },
  ] = await Promise.all([
    supabase.from("player_profile_emails").select("*").eq("player_profile_id", playerId).order("created_at"),
    supabase.from("player_profile_parent_links").select("*").eq("player_profile_id", playerId).order("created_at"),
    supabase
      .from("passport_team_members")
      .select("*, passport_teams(*)")
      .eq("player_profile_id", playerId)
      .eq("member_role", "player")
      .neq("status", "removed"),
    supabase.from("player_clips").select("*").eq("player_profile_id", playerId).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.from("player_clip_comments").select("*").eq("player_profile_id", playerId).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.from("player_feedback_comments").select("*").eq("player_profile_id", playerId).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.from("player_development_focuses").select("*").eq("player_profile_id", playerId).order("priority"),
    supabase.from("player_game_reflections").select("*").eq("player_profile_id", playerId).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.from("player_handoff_summaries").select("*").eq("player_profile_id", playerId).neq("status", "removed").order("created_at", { ascending: false }),
    supabase.from("player_profile_access").select("*").eq("player_profile_id", playerId).order("created_at", { ascending: false }),
    supabase.from("player_development_timeline").select("*").eq("player_profile_id", playerId).eq("status", "active").order("occurred_at", { ascending: false }),
  ]);

  const teams = ((memberships ?? []) as Array<PassportTeamMember & { passport_teams?: PassportTeam | null }>)
    .map((membership) =>
      membership.passport_teams
        ? {
            ...membership.passport_teams,
            member: {
              id: membership.id,
              team_id: membership.team_id,
              user_id: membership.user_id,
              player_profile_id: membership.player_profile_id,
              member_role: membership.member_role,
              staff_role: membership.staff_role,
              status: membership.status,
              joined_at: membership.joined_at,
              created_at: membership.created_at,
              updated_at: membership.updated_at,
            },
          }
        : null,
    )
    .filter((team): team is PassportTeam & { member: PassportTeamMember } => Boolean(team));

  return {
    profile,
    emails: (emails ?? []) as PlayerProfileEmail[],
    parentLinks: (parentLinks ?? []) as PlayerParentLink[],
    teams,
    clips: (clips ?? []) as PlayerClip[],
    clipComments: (comments ?? []) as PlayerClipComment[],
    feedback: (feedback ?? []) as PlayerFeedbackComment[],
    focuses: (focuses ?? []) as PlayerDevelopmentFocus[],
    reflections: (reflections ?? []) as PlayerGameReflection[],
    handoffs: (handoffs ?? []) as PlayerHandoffSummary[],
    accessGrants: (accessGrants ?? []) as PlayerProfileAccess[],
    timeline: (timeline ?? []) as PlayerTimelineEvent[],
  };
}

export async function getCoachPassportDashboard(coachUserId: string): Promise<CoachPassportDashboard> {
  noStore();
  if (!hasPassportConfig()) {
    return { teams: [], invites: [], playerCount: 0, pendingInviteCount: 0 };
  }

  const supabase = createSupabaseAdminClient();
  const { data: teams, error } = await supabase
    .from("passport_teams")
    .select("*")
    .eq("coach_user_id", coachUserId)
    .neq("status", "removed")
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingPassportTableError(error)) {
      return { teams: [], invites: [], playerCount: 0, pendingInviteCount: 0 };
    }

    throw error;
  }

  const teamIds = (teams ?? []).map((team) => team.id);
  const [{ data: invites }, { count: playerCount }] = teamIds.length
    ? await Promise.all([
        supabase
          .from("passport_roster_invites")
          .select("*")
          .in("team_id", teamIds)
          .order("created_at", { ascending: false })
          .limit(25),
        supabase
          .from("passport_team_members")
          .select("id", { count: "exact", head: true })
          .in("team_id", teamIds)
          .eq("member_role", "player")
          .eq("status", "active"),
      ])
    : [{ data: [] }, { count: 0 }];

  return {
    teams: (teams ?? []) as PassportTeam[],
    invites: (invites ?? []) as PassportRosterInvite[],
    playerCount: playerCount ?? 0,
    pendingInviteCount: ((invites ?? []) as PassportRosterInvite[]).filter((invite) => invite.status === "sent").length,
  };
}

export async function getCoachPassportTeamBundle(teamId: string, coachUserId: string): Promise<CoachPassportTeamBundle | null> {
  noStore();
  if (!hasPassportConfig()) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: team, error } = await supabase
    .from("passport_teams")
    .select("*")
    .eq("id", teamId)
    .neq("status", "removed")
    .maybeSingle<PassportTeam>();

  if (error) {
    if (isMissingPassportTableError(error)) {
      return null;
    }

    throw error;
  }

  if (!team) {
    return null;
  }

  const staffAccess =
    team.coach_user_id === coachUserId ||
    Boolean(
      (
        await supabase
          .from("passport_team_members")
          .select("id")
          .eq("team_id", teamId)
          .eq("user_id", coachUserId)
          .in("member_role", ["head_coach", "assistant_coach", "support_coach"])
          .eq("status", "active")
          .maybeSingle<{ id: string }>()
      ).data,
    );

  if (!staffAccess) {
    return null;
  }

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("passport_team_members").select("*").eq("team_id", teamId).neq("status", "removed").order("created_at"),
    supabase.from("passport_roster_invites").select("*").eq("team_id", teamId).order("created_at", { ascending: false }),
  ]);
  const playerIds = ((members ?? []) as PassportTeamMember[])
    .map((member) => member.player_profile_id)
    .filter((id): id is string => Boolean(id));
  const { data: players } = playerIds.length
    ? await supabase.from("player_profiles").select("*").in("id", playerIds)
    : { data: [] };

  return {
    team,
    members: (members ?? []) as PassportTeamMember[],
    invites: (invites ?? []) as PassportRosterInvite[],
    players: (players ?? []) as PlayerProfile[],
  };
}

export async function getRosterInviteByCode(code: string, userEmail?: string | null): Promise<PassportRosterInvite | null> {
  noStore();
  if (!hasPassportConfig()) {
    return null;
  }

  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("passport_roster_invites")
    .select("*")
    .eq("join_code", cleanCode)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1);

  const email = normalizePassportEmail(userEmail);
  if (email) {
    query = query.or(
      `parent_email_normalized.eq.${email},player_school_email_normalized.eq.${email},player_personal_email_normalized.eq.${email}`,
    );
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingPassportTableError(error)) {
      return null;
    }

    throw error;
  }

  return ((data ?? []) as PassportRosterInvite[])[0] ?? null;
}

export async function getAdminPassportDashboard(): Promise<AdminPassportDashboard> {
  noStore();
  if (!hasPassportConfig()) {
    return { players: [], teams: [], reports: [], invites: [] };
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: players, error }, { data: teams }, { data: reports }, { data: invites }] = await Promise.all([
    supabase.from("player_profiles").select("*").order("updated_at", { ascending: false }).limit(100),
    supabase.from("passport_teams").select("*").order("updated_at", { ascending: false }).limit(100),
    supabase.from("passport_content_reports").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("passport_roster_invites").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  if (error) {
    if (isMissingPassportTableError(error)) {
      return { players: [], teams: [], reports: [], invites: [] };
    }

    throw error;
  }

  return {
    players: (players ?? []) as PlayerProfile[],
    teams: (teams ?? []) as PassportTeam[],
    reports: (reports ?? []) as PassportContentReport[],
    invites: (invites ?? []) as PassportRosterInvite[],
  };
}
