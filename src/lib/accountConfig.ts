let warnedAboutProductionBypass = false;

export function isPhoneVerificationBypassed() {
  const bypassed = process.env.REPPY_DISABLE_PHONE_VERIFICATION === "true";

  if (bypassed && process.env.NODE_ENV === "production" && !warnedAboutProductionBypass) {
    warnedAboutProductionBypass = true;
    console.warn(
      "[account] REPPY_DISABLE_PHONE_VERIFICATION is enabled in production. This is a temporary development/MVP bypass and should be removed before requiring verified phone numbers.",
    );
  }

  return bypassed;
}

export function phoneVerificationBypassStatus() {
  return {
    enabled: isPhoneVerificationBypassed(),
    env: "REPPY_DISABLE_PHONE_VERIFICATION",
  };
}
