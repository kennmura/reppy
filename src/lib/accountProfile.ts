import type { UserCoachingPreference, UserProfile } from "./types";

export type AccountRequestProfile = {
  role: "parent" | "adult_player";
  playerName: string;
  guardianName: string;
  playerAge: string;
  currentTeam: string;
  preferredLocation: string;
  skillLevel: string;
  position: string;
  goals: string;
  preferredDays: string;
};

function clean(value: string | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function accountRequestProfileFrom({
  profile,
  preference,
}: {
  profile: UserProfile;
  preference: UserCoachingPreference | null;
}): AccountRequestProfile {
  const playerName = clean(preference?.player_name) || clean(profile.display_name);
  return {
    role: profile.role === "adult_player" ? "adult_player" : "parent",
    playerName,
    guardianName: clean(preference?.guardian_name),
    playerAge: clean(preference?.player_age) || clean(preference?.age_group),
    currentTeam: clean(preference?.current_team),
    preferredLocation: clean(preference?.location_text),
    skillLevel: clean(preference?.skill_level),
    position: clean(preference?.position),
    goals: clean(preference?.training_goals),
    preferredDays: clean(preference?.preferred_days),
  };
}

export function missingAccountRequestProfileFields(accountProfile: AccountRequestProfile) {
  const missing: string[] = [];

  if (!accountProfile.playerName) {
    missing.push("player_name");
  }

  if (accountProfile.role === "parent" && !accountProfile.guardianName) {
    missing.push("guardian_name");
  }

  if (!accountProfile.playerAge) {
    missing.push("player_age");
  }

  if (!accountProfile.currentTeam) {
    missing.push("current_team");
  }

  return missing;
}

export function isAccountRequestProfileComplete(accountProfile: AccountRequestProfile) {
  return missingAccountRequestProfileFields(accountProfile).length === 0;
}

export function ageRangeFromProfile(accountProfile: AccountRequestProfile) {
  const parsedAge = Number.parseInt(accountProfile.playerAge, 10);
  if (!Number.isFinite(parsedAge)) {
    return accountProfile.playerAge;
  }

  if (parsedAge < 13) {
    return "Under 13";
  }

  if (parsedAge <= 15) {
    return "13-15";
  }

  if (parsedAge <= 18) {
    return "16-18";
  }

  return "19+";
}

export function isMinorFromProfile(accountProfile: AccountRequestProfile) {
  const parsedAge = Number.parseInt(accountProfile.playerAge, 10);
  return Number.isFinite(parsedAge) ? parsedAge < 18 : accountProfile.role === "parent";
}

export function currentLevelFromProfile(accountProfile: AccountRequestProfile) {
  return [accountProfile.skillLevel, accountProfile.currentTeam].filter(Boolean).join(" - ");
}
