import { redirect } from "next/navigation";

export default function CoachLoginRedirectPage() {
  redirect("/account/login?role=coach");
}
