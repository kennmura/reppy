"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountContextOrRedirect, getAdminUserOrRedirect, getCoachContextOrRedirect } from "./auth";
import { createNotification } from "./notifications";
import {
  canCoachAccessPlayer,
  canManagePlayerProfile,
  getCoachPassportTeamBundle,
  getPlayerPassportBundle,
  getRosterInviteByCode,
  normalizePassportEmail,
  slugifyPassportName,
} from "./passportData";
import type { PassportContentReportReason, PassportRosterInvite, PassportTeam, PlayerClip, PlayerProfile } from "./passportTypes";
import { createSupabaseAdminClient } from "./supabase";

const baseButtonRedirect = "/account/passport";
const allowedSports = new Set(["soccer", "basketball"]);
const reportReasons = new Set<PassportContentReportReason>([
  "inappropriate_content",
  "harassment",
  "bullying",
  "private_information",
  "false_information",
  "unsafe_adult_minor_communication",
  "spam",
  "other",
]);

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

function nullableValue(formData: FormData, key: string) {
  const text = value(formData, key);
  return text || null;
}

function boolValue(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function intValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) {
    return null;
  }

  const number = Number.parseInt(raw, 10);
  return Number.isFinite(number) ? number : null;
}

function stringList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function redirectWithError(returnTo: string, code: string): never {
  redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${code}`);
}

function token(bytes = 9) {
  return randomBytes(bytes).toString("base64url").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 10);
}

async function uniquePlayerSlug(displayName: string, currentId?: string | null) {
  const supabase = createSupabaseAdminClient();
  const base = slugifyPassportName(displayName) || `player-${token(4).toLowerCase()}`;
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`;
    let query = supabase.from("player_profiles").select("id").eq("slug", candidate).limit(1);
    if (currentId) {
      query = query.neq("id", currentId);
    }
    const { data } = await query;
    if (!(data ?? []).length) {
      return candidate;
    }
  }

  return `${base}-${token(5).toLowerCase()}`;
}

async function createTimelineEvent({
  playerProfileId,
  teamId = null,
  actorUserId,
  eventType,
  title,
  body = null,
  sourceTable = null,
  sourceId = null,
  visibility = "connected_coaches",
}: {
  playerProfileId: string;
  teamId?: string | null;
  actorUserId: string | null;
  eventType: string;
  title: string;
  body?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  visibility?: string;
}) {
  const supabase = createSupabaseAdminClient();
  await supabase.from("player_development_timeline").insert({
    player_profile_id: playerProfileId,
    team_id: teamId,
    actor_user_id: actorUserId,
    event_type: eventType,
    title,
    body,
    source_table: sourceTable,
    source_id: sourceId,
    visibility,
  });
}

async function upsertProfileEmail(playerProfileId: string, email: string | null, emailType: "school" | "personal" | "parent") {
  if (!email) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  await supabase.from("player_profile_emails").upsert(
    {
      player_profile_id: playerProfileId,
      email_normalized: email,
      email_type: emailType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_profile_id,email_normalized" },
  );
}

export async function saveAccountPlayerProfileAction(formData: FormData) {
  const { user, profile } = await getAccountContextOrRedirect();
  const returnTo = value(formData, "return_to") || baseButtonRedirect;
  const playerId = nullableValue(formData, "player_id");
  const displayName = value(formData, "display_name");
  const sport = value(formData, "sport") || "soccer";

  if (!displayName || !allowedSports.has(sport)) {
    redirectWithError(returnTo, "missing-profile");
  }

  if (playerId && !(await canManagePlayerProfile(user.id, playerId))) {
    redirectWithError(returnTo, "not-authorized");
  }

  const supabase = createSupabaseAdminClient();
  const isMinor = boolValue(formData, "is_minor");
  const visibility = !isMinor && (boolValue(formData, "visibility_public") || value(formData, "visibility") === "public") ? "public" : "private";
  const slug = await uniquePlayerSlug(displayName, playerId);
  const payload: Record<string, unknown> = {
    created_by_user_id: user.id,
    slug,
    display_name: displayName,
    sport,
    position: nullableValue(formData, "position"),
    secondary_positions: stringList(value(formData, "secondary_positions")),
    graduation_year: intValue(formData, "graduation_year"),
    current_team: nullableValue(formData, "current_team"),
    achievements: nullableValue(formData, "achievements"),
    strengths: nullableValue(formData, "strengths"),
    goals: nullableValue(formData, "goals"),
    height: nullableValue(formData, "height"),
    dominant_foot: nullableValue(formData, "dominant_foot"),
    dominant_hand: nullableValue(formData, "dominant_hand"),
    position_group: nullableValue(formData, "position_group"),
    preferred_side: nullableValue(formData, "preferred_side"),
    playing_style: nullableValue(formData, "playing_style"),
    bio: nullableValue(formData, "bio"),
    city: nullableValue(formData, "city"),
    state: nullableValue(formData, "state"),
    profile_photo_url: nullableValue(formData, "profile_photo_url"),
    banner_image_url: nullableValue(formData, "banner_image_url"),
    visibility,
    team_names_public: boolValue(formData, "team_names_public"),
    height_public: boolValue(formData, "height_public"),
    location_public: boolValue(formData, "location_public"),
    is_minor: isMinor,
    date_of_birth: nullableValue(formData, "date_of_birth"),
    updated_at: new Date().toISOString(),
  };
  if (!playerId) {
    payload.user_id = profile.role === "adult_player" ? user.id : null;
  }

  const query = playerId
    ? supabase.from("player_profiles").update(payload).eq("id", playerId).select("*").single<PlayerProfile>()
    : supabase.from("player_profiles").insert(payload).select("*").single<PlayerProfile>();

  const { data: savedProfile, error } = await query;
  if (error || !savedProfile) {
    console.error("[passport] player profile save failed", {
      userId: user.id,
      playerId,
      message: error?.message,
    });
    redirectWithError(returnTo, "profile-save-failed");
  }

  await upsertProfileEmail(savedProfile.id, normalizePassportEmail(user.email), profile.role === "parent" ? "parent" : "personal");
  const parentEmail = normalizePassportEmail(formData.get("parent_email"));
  await upsertProfileEmail(savedProfile.id, parentEmail, "parent");
  if (parentEmail) {
    const { data: existingParentLink } = await supabase
      .from("player_profile_parent_links")
      .select("id")
      .eq("player_profile_id", savedProfile.id)
      .eq("parent_email_normalized", parentEmail)
      .neq("status", "revoked")
      .maybeSingle<{ id: string }>();
    if (existingParentLink) {
      await supabase
        .from("player_profile_parent_links")
        .update({
          parent_user_id: profile.role === "parent" && parentEmail === normalizePassportEmail(user.email) ? user.id : null,
          status: profile.role === "parent" && parentEmail === normalizePassportEmail(user.email) ? "active" : "invited",
          claimed_at: profile.role === "parent" && parentEmail === normalizePassportEmail(user.email) ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingParentLink.id);
    } else {
      await supabase.from("player_profile_parent_links").insert({
        player_profile_id: savedProfile.id,
        parent_email_normalized: parentEmail,
        parent_user_id: profile.role === "parent" && parentEmail === normalizePassportEmail(user.email) ? user.id : null,
        relationship: "parent_guardian",
        status: profile.role === "parent" && parentEmail === normalizePassportEmail(user.email) ? "active" : "invited",
        invited_by_user_id: user.id,
        claimed_at: profile.role === "parent" && parentEmail === normalizePassportEmail(user.email) ? new Date().toISOString() : null,
      });
    }
  }

  await createTimelineEvent({
    playerProfileId: savedProfile.id,
    actorUserId: user.id,
    eventType: playerId ? "profile_updated" : "profile_created",
    title: playerId ? "Passport profile updated" : "Passport profile created",
    body: "Player profile details were saved.",
    visibility: savedProfile.visibility === "public" ? "public" : "player_parent",
  });

  revalidatePath("/account/passport");
  revalidatePath(`/account/passport/${savedProfile.id}`);
  if (savedProfile.slug) {
    revalidatePath(`/players/${savedProfile.slug}`);
  }
  redirect(`/account/passport/${savedProfile.id}?saved=1`);
}

export async function createPassportTeamAction(formData: FormData) {
  const { user, coach } = await getCoachContextOrRedirect();
  const name = value(formData, "name");
  const sport = value(formData, "sport");
  const returnTo = value(formData, "return_to") || "/coach/passport/teams/new";
  if (!name || !allowedSports.has(sport)) {
    redirectWithError(returnTo, "missing-team");
  }

  const supabase = createSupabaseAdminClient();
  let joinCode = token(7);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data } = await supabase.from("passport_teams").select("id").eq("join_code", joinCode).maybeSingle();
    if (!data) {
      break;
    }
    joinCode = token(7);
  }

  const { data: team, error } = await supabase
    .from("passport_teams")
    .insert({
      coach_user_id: user.id,
      coach_id: coach.id,
      name,
      sport,
      team_type: value(formData, "team_type") || "high_school",
      season_name: nullableValue(formData, "season_name"),
      age_group: nullableValue(formData, "age_group"),
      school_or_club: nullableValue(formData, "school_or_club"),
      city: nullableValue(formData, "city"),
      state: nullableValue(formData, "state"),
      join_code: joinCode,
    })
    .select("*")
    .single<PassportTeam>();

  if (error || !team) {
    console.error("[passport] team create failed", {
      userId: user.id,
      coachId: coach.id,
      message: error?.message,
    });
    redirectWithError(returnTo, "team-create-failed");
  }

  await supabase.from("passport_team_members").insert({
    team_id: team.id,
    user_id: user.id,
    member_role: "head_coach",
    staff_role: "head",
    status: "active",
  });

  revalidatePath("/coach/passport");
  redirect(`/coach/passport/teams/${team.id}?created=1`);
}

async function createRosterInvite({
  team,
  coachUserId,
  formData,
}: {
  team: PassportTeam;
  coachUserId: string;
  formData: FormData;
}) {
  const supabase = createSupabaseAdminClient();
  const playerName = value(formData, "player_name");
  const parentEmail = normalizePassportEmail(formData.get("parent_email"));
  const schoolEmail = normalizePassportEmail(formData.get("player_school_email"));
  const personalEmail = normalizePassportEmail(formData.get("player_personal_email"));

  if (!playerName || (!parentEmail && !schoolEmail && !personalEmail)) {
    throw new Error("missing-roster-player");
  }

  const profileSlug = await uniquePlayerSlug(playerName);
  const { data: player, error: playerError } = await supabase
    .from("player_profiles")
    .insert({
      display_name: playerName,
      slug: profileSlug,
      sport: team.sport,
      position: nullableValue(formData, "position"),
      graduation_year: intValue(formData, "graduation_year"),
      current_team: team.name,
      height: nullableValue(formData, "height"),
      visibility: "private",
      is_minor: true,
      created_by_user_id: coachUserId,
    })
    .select("*")
    .single<PlayerProfile>();

  if (playerError || !player) {
    throw playerError ?? new Error("player-create-failed");
  }

  await Promise.all([
    upsertProfileEmail(player.id, parentEmail, "parent"),
    upsertProfileEmail(player.id, schoolEmail, "school"),
    upsertProfileEmail(player.id, personalEmail, "personal"),
    parentEmail
      ? supabase.from("player_profile_parent_links").insert({
          player_profile_id: player.id,
          parent_email_normalized: parentEmail,
          status: "invited",
          invited_by_user_id: coachUserId,
        })
      : Promise.resolve(),
    supabase.from("passport_team_members").insert({
      team_id: team.id,
      player_profile_id: player.id,
      member_role: "player",
      status: "active",
    }),
  ]);

  const inviteToken = randomBytes(24).toString("base64url");
  const { data: invite, error: inviteError } = await supabase
    .from("passport_roster_invites")
    .insert({
      team_id: team.id,
      player_profile_id: player.id,
      player_name: playerName,
      parent_email_normalized: parentEmail,
      player_school_email_normalized: schoolEmail,
      player_personal_email_normalized: personalEmail,
      position: nullableValue(formData, "position"),
      jersey_number: nullableValue(formData, "jersey_number"),
      graduation_year: intValue(formData, "graduation_year"),
      height: nullableValue(formData, "height"),
      team_name: team.name,
      season_name: team.season_name,
      coach_notes: nullableValue(formData, "coach_notes"),
      invite_token: inviteToken,
      join_code: team.join_code,
      status: "sent",
      created_by_user_id: coachUserId,
    })
    .select("*")
    .single<PassportRosterInvite>();

  if (inviteError || !invite) {
    throw inviteError ?? new Error("invite-create-failed");
  }

  await createTimelineEvent({
    playerProfileId: player.id,
    teamId: team.id,
    actorUserId: coachUserId,
    eventType: "team_joined",
    title: `Added to ${team.name}`,
    body: team.season_name,
    visibility: "connected_coaches",
  });

  return invite;
}

export async function addRosterPlayerAction(formData: FormData) {
  const { user } = await getCoachContextOrRedirect();
  const teamId = value(formData, "team_id");
  const returnTo = value(formData, "return_to") || `/coach/passport/teams/${teamId}/roster`;
  const bundle = await getCoachPassportTeamBundle(teamId, user.id);
  if (!bundle) {
    redirectWithError(returnTo, "team-not-found");
  }

  try {
    await createRosterInvite({ team: bundle.team, coachUserId: user.id, formData });
  } catch (error) {
    console.error("[passport] roster invite failed", {
      teamId,
      coachUserId: user.id,
      message: error instanceof Error ? error.message : String(error),
    });
    redirectWithError(returnTo, "roster-save-failed");
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?roster=added`);
}

function parseCsvRows(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine || !rows.length) {
    return [];
  }

  const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());
  return rows.slice(0, 100).map((row) => {
    const cells = row.split(",").map((cell) => cell.trim());
    const formData = new FormData();
    headers.forEach((header, index) => formData.set(header, cells[index] ?? ""));
    return formData;
  });
}

export async function importRosterCsvAction(formData: FormData) {
  const { user } = await getCoachContextOrRedirect();
  const teamId = value(formData, "team_id");
  const returnTo = value(formData, "return_to") || `/coach/passport/teams/${teamId}/roster`;
  const bundle = await getCoachPassportTeamBundle(teamId, user.id);
  if (!bundle) {
    redirectWithError(returnTo, "team-not-found");
  }

  const rows = parseCsvRows(value(formData, "csv_text"));
  if (!rows.length) {
    redirectWithError(returnTo, "csv-empty");
  }

  let created = 0;
  for (const row of rows) {
    row.set("team_id", teamId);
    try {
      await createRosterInvite({ team: bundle.team, coachUserId: user.id, formData: row });
      created += 1;
    } catch (error) {
      console.error("[passport] CSV roster row skipped", {
        teamId,
        coachUserId: user.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?csv_imported=${created}`);
}

export async function acceptRosterInviteAction(formData: FormData) {
  const { user, profile } = await getAccountContextOrRedirect();
  const code = value(formData, "join_code");
  const returnTo = value(formData, "return_to") || "/passport/join";
  const invite = await getRosterInviteByCode(code, user.email);
  if (!invite) {
    redirectWithError(returnTo, "invite-not-found");
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  if (profile.role === "adult_player") {
    await supabase.from("player_profiles").update({ user_id: user.id, updated_at: now }).eq("id", invite.player_profile_id);
    await supabase
      .from("passport_team_members")
      .update({ user_id: user.id, status: "active", joined_at: now, updated_at: now })
      .eq("team_id", invite.team_id)
      .eq("player_profile_id", invite.player_profile_id);
  } else {
    if (!invite.player_profile_id) {
      redirectWithError(returnTo, "player-not-found");
    }
    const parentEmail = normalizePassportEmail(user.email);
    let linkQuery = supabase
      .from("player_profile_parent_links")
      .select("id")
      .eq("player_profile_id", invite.player_profile_id)
      .neq("status", "revoked");
    linkQuery = parentEmail
      ? linkQuery.or(`parent_user_id.eq.${user.id},parent_email_normalized.eq.${parentEmail}`)
      : linkQuery.eq("parent_user_id", user.id);
    const { data: existingLink } = await linkQuery.maybeSingle<{ id: string }>();
    if (existingLink) {
      await supabase
        .from("player_profile_parent_links")
        .update({
          parent_user_id: user.id,
          parent_email_normalized: parentEmail,
          relationship: "parent_guardian",
          status: "active",
          claimed_at: now,
          updated_at: now,
        })
        .eq("id", existingLink.id);
    } else {
      await supabase.from("player_profile_parent_links").insert({
        player_profile_id: invite.player_profile_id,
        parent_user_id: user.id,
        parent_email_normalized: parentEmail,
        relationship: "parent_guardian",
        status: "active",
        claimed_at: now,
      });
    }
  }

  await supabase
    .from("passport_roster_invites")
    .update({ status: "accepted", accepted_by_user_id: user.id, accepted_at: now, updated_at: now })
    .eq("id", invite.id);

  if (invite.player_profile_id) {
    await createTimelineEvent({
      playerProfileId: invite.player_profile_id,
      teamId: invite.team_id,
      actorUserId: user.id,
      eventType: "roster_invite_accepted",
      title: "Roster invite accepted",
      body: "A player or parent linked this roster invite to their Reppy account.",
      visibility: "connected_coaches",
    });
  }

  revalidatePath("/account/passport");
  redirect(invite.player_profile_id ? `/account/passport/${invite.player_profile_id}?joined=1` : "/account/passport?joined=1");
}

export async function addPlayerClipAction(formData: FormData) {
  const source = value(formData, "source") === "coach_upload" ? "coach_upload" : "player_upload";
  const playerId = value(formData, "player_profile_id");
  const returnTo = value(formData, "return_to") || `/account/passport/${playerId}/clips`;
  const title = value(formData, "title");
  const durationSeconds = intValue(formData, "duration_seconds");
  const supabase = createSupabaseAdminClient();
  let userId: string;
  let teamId: string | null = nullableValue(formData, "team_id");

  if (!title || !playerId || (durationSeconds !== null && durationSeconds > 15)) {
    redirectWithError(returnTo, "invalid-clip");
  }

  if (source === "coach_upload") {
    const { user } = await getCoachContextOrRedirect();
    userId = user.id;
    if (!(await canCoachAccessPlayer({ coachUserId: user.id, playerId, teamId }))) {
      redirectWithError(returnTo, "not-authorized");
    }
  } else {
    const { user } = await getAccountContextOrRedirect();
    userId = user.id;
    if (!(await canManagePlayerProfile(user.id, playerId))) {
      redirectWithError(returnTo, "not-authorized");
    }
    teamId = null;
  }

  const { count } = await supabase
    .from("player_clips")
    .select("id", { count: "exact", head: true })
    .eq("player_profile_id", playerId)
    .eq("source", source)
    .eq("status", "active");

  if ((count ?? 0) >= 4) {
    redirectWithError(returnTo, source === "coach_upload" ? "coach-clip-limit" : "player-clip-limit");
  }

  const visibility = source === "coach_upload" ? "private" : value(formData, "visibility") || "private";
  const { data: clip, error } = await supabase
    .from("player_clips")
    .insert({
      player_profile_id: playerId,
      uploaded_by_user_id: userId,
      uploaded_by_role: source === "coach_upload" ? "team_coach" : "player",
      team_id: teamId,
      title,
      description: nullableValue(formData, "description"),
      clip_type: value(formData, "clip_type") || "training",
      storage_path: nullableValue(formData, "storage_path"),
      public_url: nullableValue(formData, "public_url"),
      thumbnail_url: nullableValue(formData, "thumbnail_url"),
      visibility,
      source,
      duration_seconds: durationSeconds,
    })
    .select("*")
    .single<PlayerClip>();

  if (error || !clip) {
    console.error("[passport] clip save failed", {
      playerId,
      source,
      message: error?.message,
    });
    redirectWithError(returnTo, "clip-save-failed");
  }

  await createTimelineEvent({
    playerProfileId: playerId,
    teamId,
    actorUserId: userId,
    eventType: source === "coach_upload" ? "coach_clip_uploaded" : "player_clip_uploaded",
    title: source === "coach_upload" ? "Coach clip uploaded" : "Player clip uploaded",
    body: clip.title,
    sourceTable: "player_clips",
    sourceId: clip.id,
    visibility: visibility === "public" && source === "player_upload" ? "public" : "connected_coaches",
  });

  revalidatePath(returnTo);
  redirect(`${returnTo}?clip=added`);
}

export async function archivePlayerClipAction(formData: FormData) {
  const { user } = await getAccountContextOrRedirect();
  const playerId = value(formData, "player_profile_id");
  const clipId = value(formData, "clip_id");
  const returnTo = value(formData, "return_to") || `/account/passport/${playerId}/clips`;
  if (!(await canManagePlayerProfile(user.id, playerId))) {
    redirectWithError(returnTo, "not-authorized");
  }

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("player_clips")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", clipId)
    .eq("player_profile_id", playerId)
    .eq("source", "player_upload");
  revalidatePath(returnTo);
  redirect(`${returnTo}?clip=archived`);
}

export async function addCoachFeedbackAction(formData: FormData) {
  const { user } = await getCoachContextOrRedirect();
  const playerId = value(formData, "player_profile_id");
  const teamId = nullableValue(formData, "team_id");
  const returnTo = value(formData, "return_to") || `/coach/passport/teams/${teamId}/players/${playerId}`;
  if (!playerId || !(await canCoachAccessPlayer({ coachUserId: user.id, playerId, teamId }))) {
    redirectWithError(returnTo, "not-authorized");
  }

  const body = value(formData, "body");
  if (!body) {
    redirectWithError(returnTo, "missing-feedback");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("player_feedback_comments")
    .insert({
      player_profile_id: playerId,
      author_user_id: user.id,
      team_id: teamId,
      clip_id: nullableValue(formData, "clip_id"),
      reflection_id: nullableValue(formData, "reflection_id"),
      focus_area_id: nullableValue(formData, "focus_area_id"),
      comment_type: value(formData, "comment_type") || "simple_comment",
      body,
      player_strength_observed: nullableValue(formData, "player_strength_observed"),
      improvement_area: nullableValue(formData, "improvement_area"),
      recommended_drill: nullableValue(formData, "recommended_drill"),
      visibility: value(formData, "visibility") || "player_parent",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    console.error("[passport] feedback save failed", {
      playerId,
      teamId,
      message: error?.message,
    });
    redirectWithError(returnTo, "feedback-save-failed");
  }

  await createTimelineEvent({
    playerProfileId: playerId,
    teamId,
    actorUserId: user.id,
    eventType: "coach_feedback_added",
    title: "Coach feedback added",
    body: "A connected coach added development feedback.",
    sourceTable: "player_feedback_comments",
    sourceId: data.id,
    visibility: "connected_coaches",
  });

  const bundle = await getPlayerPassportBundle(playerId);
  if (bundle?.profile.user_id) {
    await createNotification({
      userId: bundle.profile.user_id,
      type: "system",
      title: "New coach feedback",
      body: "A connected coach added feedback to your Reppy Passport.",
      actionUrl: `/account/passport/${playerId}`,
    }).catch(() => null);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?feedback=added`);
}

export async function addDevelopmentFocusAction(formData: FormData) {
  const { user } = await getCoachContextOrRedirect();
  const playerId = value(formData, "player_profile_id");
  const teamId = nullableValue(formData, "team_id");
  const returnTo = value(formData, "return_to") || `/coach/passport/teams/${teamId}/players/${playerId}`;
  if (!playerId || !teamId || !(await canCoachAccessPlayer({ coachUserId: user.id, playerId, teamId }))) {
    redirectWithError(returnTo, "not-authorized");
  }

  const focusArea = value(formData, "focus_area");
  if (!focusArea) {
    redirectWithError(returnTo, "missing-focus");
  }

  const supabase = createSupabaseAdminClient();
  const { count } = await supabase
    .from("player_development_focuses")
    .select("id", { count: "exact", head: true })
    .eq("player_profile_id", playerId)
    .eq("team_id", teamId)
    .eq("status", "active");

  if ((count ?? 0) >= 3) {
    redirectWithError(returnTo, "focus-limit");
  }

  const { data, error } = await supabase
    .from("player_development_focuses")
    .insert({
      player_profile_id: playerId,
      team_id: teamId,
      created_by_user_id: user.id,
      focus_area: focusArea,
      description: nullableValue(formData, "description"),
      priority: intValue(formData, "priority") ?? Math.min((count ?? 0) + 1, 3),
      visibility: value(formData, "visibility") || "player_parent",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirectWithError(returnTo, "focus-save-failed");
  }

  await createTimelineEvent({
    playerProfileId: playerId,
    teamId,
    actorUserId: user.id,
    eventType: "focus_area_added",
    title: "Focus area added",
    body: focusArea,
    sourceTable: "player_development_focuses",
    sourceId: data.id,
    visibility: "connected_coaches",
  });

  revalidatePath(returnTo);
  redirect(`${returnTo}?focus=added`);
}

export async function addGameReflectionAction(formData: FormData) {
  const { user } = await getAccountContextOrRedirect();
  const playerId = value(formData, "player_profile_id");
  const returnTo = value(formData, "return_to") || `/account/passport/${playerId}/reflections`;
  if (!playerId || !(await canManagePlayerProfile(user.id, playerId))) {
    redirectWithError(returnTo, "not-authorized");
  }

  const didWell = value(formData, "did_well");
  const struggledWith = value(formData, "struggled_with");
  const improvementFocus = value(formData, "improvement_focus");
  if (!didWell || !struggledWith || !improvementFocus) {
    redirectWithError(returnTo, "missing-reflection");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("player_game_reflections")
    .insert({
      player_profile_id: playerId,
      team_id: nullableValue(formData, "team_id"),
      created_by_user_id: user.id,
      game_date: nullableValue(formData, "game_date"),
      did_well: didWell,
      struggled_with: struggledWith,
      improvement_focus: improvementFocus,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirectWithError(returnTo, "reflection-save-failed");
  }

  await createTimelineEvent({
    playerProfileId: playerId,
    teamId: nullableValue(formData, "team_id"),
    actorUserId: user.id,
    eventType: "game_reflection_submitted",
    title: "Game reflection submitted",
    body: improvementFocus,
    sourceTable: "player_game_reflections",
    sourceId: data.id,
    visibility: "connected_coaches",
  });

  revalidatePath(returnTo);
  redirect(`${returnTo}?reflection=added`);
}

export async function saveHandoffSummaryAction(formData: FormData) {
  const { user } = await getCoachContextOrRedirect();
  const playerId = value(formData, "player_profile_id");
  const teamId = nullableValue(formData, "team_id");
  const returnTo = value(formData, "return_to") || `/coach/passport/teams/${teamId}/handoff`;
  if (!playerId || !teamId) {
    redirectWithError(returnTo, "not-authorized");
  }

  if (!(await canCoachAccessPlayer({ coachUserId: user.id, playerId, teamId }))) {
    redirectWithError(returnTo, "not-authorized");
  }

  const status = value(formData, "status") === "published" ? "published" : "draft";
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("player_handoff_summaries")
    .insert({
      player_profile_id: playerId,
      team_id: teamId,
      generated_by_user_id: user.id,
      summary_mode: value(formData, "summary_mode") || "manual",
      strengths: nullableValue(formData, "strengths"),
      improvement_areas: nullableValue(formData, "improvement_areas"),
      recommended_focus: nullableValue(formData, "recommended_focus"),
      coach_summary: nullableValue(formData, "coach_summary"),
      next_season_notes: nullableValue(formData, "next_season_notes"),
      internal_staff_notes: nullableValue(formData, "internal_staff_notes"),
      visibility: value(formData, "visibility") || "shared_passport",
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) {
    redirectWithError(returnTo, "handoff-save-failed");
  }

  await createTimelineEvent({
    playerProfileId: playerId,
    teamId,
    actorUserId: user.id,
    eventType: "handoff_summary_published",
    title: status === "published" ? "Handoff summary published" : "Handoff summary drafted",
    body: nullableValue(formData, "coach_summary"),
    sourceTable: "player_handoff_summaries",
    sourceId: data.id,
    visibility: status === "published" ? "shared_passport" : "connected_coaches",
  });

  revalidatePath(returnTo);
  redirect(`${returnTo}?handoff=${status}`);
}

export async function generateHandoffDraftAction(formData: FormData) {
  const { user } = await getCoachContextOrRedirect();
  const playerId = value(formData, "player_profile_id");
  const teamId = nullableValue(formData, "team_id");
  const returnTo = value(formData, "return_to") || `/coach/passport/teams/${teamId}/handoff`;
  if (!playerId || !teamId || !(await canCoachAccessPlayer({ coachUserId: user.id, playerId, teamId }))) {
    redirectWithError(returnTo, "not-authorized");
  }

  const bundle = await getPlayerPassportBundle(playerId);
  if (!bundle) {
    redirectWithError(returnTo, "player-not-found");
  }

  const activeFocuses = bundle.focuses
    .filter((focus) => focus.status === "active" && focus.team_id === teamId)
    .map((focus) => focus.focus_area)
    .slice(0, 3);
  const feedback = bundle.feedback.filter((item) => item.team_id === teamId && item.status === "active").slice(0, 6);
  const strengths = feedback.map((item) => item.player_strength_observed).filter(Boolean).join("; ");
  const improvements = feedback.map((item) => item.improvement_area).filter(Boolean).join("; ");
  const drills = feedback.map((item) => item.recommended_drill).filter(Boolean).join("; ");
  const summary = [
    `${bundle.profile.display_name} has worked through ${activeFocuses.length || "several"} current focus areas this season.`,
    feedback.length ? "Recent coach feedback should be reviewed before the next season starts." : "Add more coach feedback to make future handoff summaries richer.",
  ].join(" ");

  const draft = new FormData();
  draft.set("player_profile_id", playerId);
  draft.set("team_id", teamId);
  draft.set("return_to", returnTo);
  draft.set("summary_mode", "generated_draft");
  draft.set("status", "draft");
  draft.set("strengths", strengths || bundle.profile.strengths || "");
  draft.set("improvement_areas", improvements || activeFocuses.join("; "));
  draft.set("recommended_focus", drills || activeFocuses.join("; "));
  draft.set("coach_summary", summary);
  draft.set("next_season_notes", "Review current focus areas, recent reflections, and coach feedback before planning the next season.");
  draft.set("visibility", "shared_passport");
  await saveHandoffSummaryAction(draft);
}

export async function reportPassportContentAction(formData: FormData) {
  const user = formData.get("reporter_role") === "coach"
    ? (await getCoachContextOrRedirect()).user
    : (await getAccountContextOrRedirect()).user;
  const reason = value(formData, "reason") as PassportContentReportReason;
  const returnTo = value(formData, "return_to") || "/";
  if (!reportReasons.has(reason)) {
    redirectWithError(returnTo, "invalid-report");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("passport_content_reports").insert({
    reporter_user_id: user.id,
    player_profile_id: nullableValue(formData, "player_profile_id"),
    content_type: value(formData, "content_type") || "player_profile",
    content_id: nullableValue(formData, "content_id"),
    reason,
    details: nullableValue(formData, "details"),
  });

  if (error) {
    redirectWithError(returnTo, "report-failed");
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?reported=1`);
}

export async function moderatePassportReportAction(formData: FormData) {
  const admin = await getAdminUserOrRedirect();
  const reportId = value(formData, "report_id");
  const status = value(formData, "status");
  const returnTo = value(formData, "return_to") || "/admin/passport/reports";
  if (!reportId || !["reviewing", "resolved", "dismissed"].includes(status)) {
    redirectWithError(returnTo, "invalid-report");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("passport_content_reports")
    .update({
      status,
      admin_notes: nullableValue(formData, "admin_notes"),
      resolved_by: status === "resolved" || status === "dismissed" ? admin.id : null,
      resolved_at: status === "resolved" || status === "dismissed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    redirectWithError(returnTo, "moderation-failed");
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?moderated=1`);
}
