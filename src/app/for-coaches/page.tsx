import { redirect } from "next/navigation";

export default function ForCoachesRedirectPage() {
  redirect("/coach/register");
}
