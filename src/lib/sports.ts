export const sports = [
  "Soccer",
  "Basketball",
  "Tennis",
  "Golf",
  "Baseball",
  "Softball",
  "Lacrosse",
  "Hockey",
  "Volleyball",
  "Track & Field",
  "Strength & Conditioning",
  "Other",
];

export function sportToSlug(sport: string) {
  return sport
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function sportFromSlug(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalizedValue = sportToSlug(value);
  return (
    sports.find(
      (sport) =>
        sportToSlug(sport) === normalizedValue ||
        sport.toLowerCase().replaceAll(" ", "-") === value.toLowerCase(),
    ) ?? null
  );
}

export function sportMatches(coachSport: string | null | undefined, selectedSport: string | null) {
  if (!selectedSport) {
    return true;
  }

  return sportToSlug(coachSport ?? "") === sportToSlug(selectedSport);
}
