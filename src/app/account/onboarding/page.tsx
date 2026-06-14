import { redirect } from "next/navigation";

export default function AccountOnboardingPage() {
  redirect("/account/settings?error=missing-player-profile");
}
