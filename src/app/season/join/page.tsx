import { redirect } from "next/navigation";

export default async function SeasonJoinRedirect({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : "";
  redirect(`/passport/join${code ? `?code=${encodeURIComponent(code)}` : ""}`);
}
