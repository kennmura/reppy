import type { AccountPrivateDetails, UserCoachingPreference, UserProfile } from "./types";

export type AccountRequestProfile = {
  role: "parent" | "adult_player";
  playerName: string;
  guardianName: string;
  playerDateOfBirth: string;
  playerAge: string;
  playerAgeAtRequest: number | null;
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

export function calculateAgeFromDateOfBirth(dateOfBirth: string, at = new Date()) {
  if (!dateOfBirth) {
    return null;
  }

  const [year, month, day] = dateOfBirth.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  const birthDate = new Date(year, month - 1, day);
  if (
    birthDate.getFullYear() !== year ||
    birthDate.getMonth() !== month - 1 ||
    birthDate.getDate() !== day ||
    birthDate > at
  ) {
    return null;
  }

  let age = at.getFullYear() - birthDate.getFullYear();
  const birthdayThisYear = new Date(at.getFullYear(), month - 1, day);
  if (at < birthdayThisYear) {
    age -= 1;
  }

  return age;
}

export function isReasonablePlayerDateOfBirth(dateOfBirth: string) {
  const age = calculateAgeFromDateOfBirth(dateOfBirth);
  return age !== null && age >= 3 && age <= 100;
}

export function accountRequestProfileFrom({
  profile,
  preference,
  privateDetails,
}: {
  profile: UserProfile;
  preference: UserCoachingPreference | null;
  privateDetails?: AccountPrivateDetails | null;
}): AccountRequestProfile {
  const playerName = clean(preference?.player_name) || clean(profile.display_name);
  const playerDateOfBirth = clean(privateDetails?.player_date_of_birth) || clean(preference?.player_birth_date);
  const calculatedAge = calculateAgeFromDateOfBirth(playerDateOfBirth);
  const fallbackAge = clean(preference?.player_age) || clean(preference?.age_group);
  return {
    role: profile.role === "adult_player" ? "adult_player" : "parent",
    playerName,
    guardianName: clean(preference?.guardian_name),
    playerDateOfBirth,
    playerAge: calculatedAge === null ? fallbackAge : String(calculatedAge),
    playerAgeAtRequest: calculatedAge,
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

  if (!accountProfile.playerDateOfBirth || accountProfile.playerAgeAtRequest === null) {
    missing.push("player_date_of_birth");
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
  const parsedAge = accountProfile.playerAgeAtRequest ?? Number.parseInt(accountProfile.playerAge, 10);
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
  const parsedAge = accountProfile.playerAgeAtRequest ?? Number.parseInt(accountProfile.playerAge, 10);
  return Number.isFinite(parsedAge) ? parsedAge < 18 : accountProfile.role === "parent";
}

export function currentLevelFromProfile(accountProfile: AccountRequestProfile) {
  return [accountProfile.skillLevel, accountProfile.currentTeam].filter(Boolean).join(" - ");
}
