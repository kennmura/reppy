import { expect, test } from "playwright/test";

test("public navigation stays simple", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation")).toContainText("Home");
  await expect(page.getByRole("navigation")).toContainText("Find Coaches");
  await expect(page.getByRole("navigation")).toContainText("Sign In / Sign Up");
  await expect(page.getByRole("navigation")).not.toContainText("For Coaches");
  await expect(page.getByRole("navigation")).not.toContainText("Coach Register");
});

test("legacy request training route redirects to coach discovery", async ({ page }) => {
  await page.goto("/request-training");

  await expect(page).toHaveURL(/\/coaches$/);
  await expect(page.getByRole("heading", { name: "Find Coaches" })).toBeVisible();
});

test("unified sign in page separates player and coach accounts", async ({ page }) => {
  await page.goto("/account/login");

  await expect(page.getByRole("heading", { name: "Player/Parent Account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coach Account" })).toBeVisible();
  await expect(page.getByText("Forgot password?")).toHaveCount(2);
  await expect(page.getByText("Reppy account")).toHaveCount(0);
});

test("coach discovery supports sport and location filters without fake distance", async ({ page }) => {
  await page.goto("/coaches?sport=soccer&location=02453&training_type=private");

  await expect(page.getByLabel("Sport")).toHaveValue("soccer");
  await expect(page.getByLabel("Location")).toHaveValue("02453");
  await expect(page.getByText("Enter your ZIP code or location to find coaches within 30 miles.")).toBeVisible();
  await expect(page.getByText("We could not calculate distance for that location yet.")).toBeVisible();
});

test("player registration catches password mismatch before submit", async ({ page }) => {
  await page.goto("/account/register");

  await page.getByLabel("Full name").fill("Test Parent");
  await page.getByLabel("Email").fill("test-parent@example.com");
  await page.getByLabel("Mobile phone number").fill("(555) 555-5555");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByLabel("Confirm password").fill("different123");
  await page.getByLabel(/Terms/).check();
  await page.getByLabel(/Privacy Policy/).check();
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Test Parent");
});
