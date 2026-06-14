import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const requireLive = process.argv.includes("--live");
const secretKey = process.env.STRIPE_SECRET_KEY ?? "";

const plans = [
  {
    label: "Premium monthly",
    env: "STRIPE_COACH_PREMIUM_MONTHLY_PRICE_ID",
    amount: 1599,
    interval: "month",
  },
  {
    label: "Premium annual",
    env: "STRIPE_COACH_PREMIUM_ANNUAL_PRICE_ID",
    amount: 16099,
    interval: "year",
  },
  {
    label: "Founding monthly",
    env: "STRIPE_COACH_FOUNDING_MONTHLY_PRICE_ID",
    amount: 599,
    interval: "month",
  },
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function keyMode() {
  if (secretKey.startsWith("sk_live_")) {
    return "live";
  }

  if (secretKey.startsWith("sk_test_")) {
    return "test";
  }

  return "unknown";
}

const mode = keyMode();

if (!secretKey) {
  fail("Missing STRIPE_SECRET_KEY.");
} else if (requireLive && mode !== "live") {
  fail("Live verification requires a live Stripe secret key.");
} else if (mode === "unknown") {
  fail("STRIPE_SECRET_KEY does not look like a Stripe test or live secret key.");
}

for (const plan of plans) {
  const priceId = process.env[plan.env] ?? "";

  if (!priceId) {
    fail(`Missing ${plan.env}.`);
    continue;
  }

  if (!priceId.startsWith("price_")) {
    fail(`${plan.env} must be a Stripe Price ID that starts with price_.`);
    continue;
  }

  const response = await fetch(`https://api.stripe.com/v1/prices/${encodeURIComponent(priceId)}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });
  const price = await response.json().catch(() => null);

  if (!response.ok || !price?.id) {
    fail(`${plan.label}: Stripe price lookup failed.`);
    continue;
  }

  if (price.livemode !== (mode === "live")) {
    fail(`${plan.label}: price mode does not match the Stripe secret key mode.`);
  }

  if (price.active !== true) {
    fail(`${plan.label}: price is not active.`);
  }

  if (price.currency !== "usd") {
    fail(`${plan.label}: expected USD currency.`);
  }

  if (price.unit_amount !== plan.amount) {
    fail(`${plan.label}: expected amount ${plan.amount} cents.`);
  }

  if (price.recurring?.interval !== plan.interval) {
    fail(`${plan.label}: expected recurring interval ${plan.interval}.`);
  }

  if (process.exitCode !== 1) {
    console.log(`${plan.label}: ok (${mode}, ${plan.amount} cents/${plan.interval})`);
  }
}
