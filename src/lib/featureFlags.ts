function flagValue(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function isSeasonModeEnabled() {
  return flagValue("REPPY_SEASON_MODE_ENABLED", true);
}

export function isPassportEnabled() {
  return flagValue("REPPY_PASSPORT_ENABLED", true);
}

export function isMarketplaceVisible() {
  return flagValue("REPPY_MARKETPLACE_VISIBLE", false);
}
