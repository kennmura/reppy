export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type GeocodedLocation = Coordinates & {
  city: string | null;
  state: string | null;
  zip_code: string | null;
};

const earthRadiusMiles = 3958.8;
const defaultCoachRadiusMiles = 30;
const knownLocations: Record<string, GeocodedLocation> = {
  "03079": { city: "Salem", state: "NH", zip_code: "03079", latitude: 42.7884, longitude: -71.2009 },
  "02453": { city: "Waltham", state: "MA", zip_code: "02453", latitude: 42.3765, longitude: -71.2356 },
  "02452": { city: "Waltham", state: "MA", zip_code: "02452", latitude: 42.3987, longitude: -71.2436 },
  "02451": { city: "Waltham", state: "MA", zip_code: "02451", latitude: 42.3984, longitude: -71.2587 },
  "02108": { city: "Boston", state: "MA", zip_code: "02108", latitude: 42.3573, longitude: -71.0645 },
  "02118": { city: "Boston", state: "MA", zip_code: "02118", latitude: 42.337, longitude: -71.0726 },
  "02458": { city: "Newton", state: "MA", zip_code: "02458", latitude: 42.3523, longitude: -71.1886 },
  "02472": { city: "Watertown", state: "MA", zip_code: "02472", latitude: 42.3709, longitude: -71.1828 },
  "02139": { city: "Cambridge", state: "MA", zip_code: "02139", latitude: 42.3647, longitude: -71.1042 },
  "02478": { city: "Belmont", state: "MA", zip_code: "02478", latitude: 42.3959, longitude: -71.1787 },
  "02420": { city: "Lexington", state: "MA", zip_code: "02420", latitude: 42.4604, longitude: -71.2223 },
  "waltham": { city: "Waltham", state: "MA", zip_code: null, latitude: 42.3765, longitude: -71.2356 },
  "waltham ma": { city: "Waltham", state: "MA", zip_code: null, latitude: 42.3765, longitude: -71.2356 },
  "waltham massachusetts": { city: "Waltham", state: "MA", zip_code: null, latitude: 42.3765, longitude: -71.2356 },
  "boston": { city: "Boston", state: "MA", zip_code: null, latitude: 42.3601, longitude: -71.0589 },
  "boston ma": { city: "Boston", state: "MA", zip_code: null, latitude: 42.3601, longitude: -71.0589 },
  "boston massachusetts": { city: "Boston", state: "MA", zip_code: null, latitude: 42.3601, longitude: -71.0589 },
  "greater boston": { city: "Boston", state: "MA", zip_code: null, latitude: 42.3601, longitude: -71.0589 },
  "greater boston middlesex county": { city: "Waltham", state: "MA", zip_code: null, latitude: 42.3765, longitude: -71.2356 },
  "middlesex county": { city: "Waltham", state: "MA", zip_code: null, latitude: 42.3765, longitude: -71.2356 },
  "middlesex county ma": { city: "Waltham", state: "MA", zip_code: null, latitude: 42.3765, longitude: -71.2356 },
  "newton": { city: "Newton", state: "MA", zip_code: null, latitude: 42.337, longitude: -71.2092 },
  "newton ma": { city: "Newton", state: "MA", zip_code: null, latitude: 42.337, longitude: -71.2092 },
  "watertown": { city: "Watertown", state: "MA", zip_code: null, latitude: 42.3709, longitude: -71.1828 },
  "watertown ma": { city: "Watertown", state: "MA", zip_code: null, latitude: 42.3709, longitude: -71.1828 },
  "watertown massachusetts": { city: "Watertown", state: "MA", zip_code: null, latitude: 42.3709, longitude: -71.1828 },
  "cambridge": { city: "Cambridge", state: "MA", zip_code: null, latitude: 42.3736, longitude: -71.1097 },
  "cambridge ma": { city: "Cambridge", state: "MA", zip_code: null, latitude: 42.3736, longitude: -71.1097 },
  "belmont": { city: "Belmont", state: "MA", zip_code: null, latitude: 42.3959, longitude: -71.1787 },
  "belmont ma": { city: "Belmont", state: "MA", zip_code: null, latitude: 42.3959, longitude: -71.1787 },
  "lexington": { city: "Lexington", state: "MA", zip_code: null, latitude: 42.4473, longitude: -71.2245 },
  "lexington ma": { city: "Lexington", state: "MA", zip_code: null, latitude: 42.4473, longitude: -71.2245 },
  "somerville": { city: "Somerville", state: "MA", zip_code: null, latitude: 42.3876, longitude: -71.0995 },
  "somerville ma": { city: "Somerville", state: "MA", zip_code: null, latitude: 42.3876, longitude: -71.0995 },
  "salem nh": { city: "Salem", state: "NH", zip_code: null, latitude: 42.7884, longitude: -71.2009 },
  "salem new hampshire": { city: "Salem", state: "NH", zip_code: null, latitude: 42.7884, longitude: -71.2009 },
  "brookline": { city: "Brookline", state: "MA", zip_code: null, latitude: 42.3318, longitude: -71.1212 },
  "brookline ma": { city: "Brookline", state: "MA", zip_code: null, latitude: 42.3318, longitude: -71.1212 },
};

export function normalizeLocationInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

export function zipCodeFromLocationInput(value: string) {
  return value.match(/\b\d{5}(?:-\d{4})?\b/)?.[0].slice(0, 5) ?? "";
}

export function geocodeLocationInput(value: string): GeocodedLocation | null {
  const normalized = normalizeLocationInput(value);
  if (!normalized) {
    return null;
  }

  const zipCode = zipCodeFromLocationInput(normalized);
  if (zipCode && knownLocations[zipCode]) {
    return knownLocations[zipCode];
  }

  return knownLocations[normalized] ?? null;
}

export function resolveCoachLocationFields({
  location,
  city,
  state,
  zipCode,
}: {
  location: string;
  city?: string;
  state?: string;
  zipCode?: string;
}) {
  const cleanCity = city?.trim() ?? "";
  const cleanState = state?.trim().toUpperCase() ?? "";
  const cleanZip = zipCode?.trim() || zipCodeFromLocationInput(location);
  const query = cleanZip || [cleanCity, cleanState].filter(Boolean).join(" ") || location;
  const geocoded = geocodeLocationInput(query) ?? geocodeLocationInput(location);
  const publicLocation =
    [cleanCity || geocoded?.city, cleanState || geocoded?.state].filter(Boolean).join(", ") ||
    cleanZip ||
    location.trim() ||
    null;

  return {
    city: cleanCity || geocoded?.city || null,
    state: cleanState || geocoded?.state || null,
    zip_code: cleanZip || geocoded?.zip_code || null,
    latitude: geocoded?.latitude ?? null,
    longitude: geocoded?.longitude ?? null,
    public_location: publicLocation,
  };
}

export function haversineMiles(from: Coordinates, to: Coordinates) {
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceMiles(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value < 0.1) {
    return "Less than 0.1 miles away";
  }

  return `${value.toFixed(1)} miles away`;
}

export function coachSearchRadiusMiles(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return defaultCoachRadiusMiles;
  }

  return Math.min(value, defaultCoachRadiusMiles);
}

export function isValidCoordinates(value: {
  latitude?: number | null;
  longitude?: number | null;
}): value is Coordinates {
  return (
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

export function isMissingCoachLocationColumnError(error: { message?: string; details?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return /(city|state|zip_code|latitude|longitude|public_location|service_radius_miles|timezone)/i.test(text) && /(column|schema cache|not find)/i.test(text);
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
