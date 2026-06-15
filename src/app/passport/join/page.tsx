import Link from "next/link";
import { acceptRosterInviteAction } from "@/lib/passportActions";
import { getRosterInviteByCode } from "@/lib/passportData";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase";

const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";

export const dynamic = "force-dynamic";

export default async function PassportJoinPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code.toUpperCase() : "";
  let userEmail: string | null = null;

  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    userEmail = data.user?.email ?? null;
  }

  const invite = code ? await getRosterInviteByCode(code, userEmail) : null;
  const next = `/passport/join${code ? `?code=${encodeURIComponent(code)}` : ""}`;

  return (
    <main className="bg-slate-50 py-12">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Team join</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Join a Reppy Passport team</h1>
          <p className="mt-3 leading-7 text-slate-600">
            Enter the team code from your coach. If you are not signed in, Reppy will preserve the code through login or signup.
          </p>
          <form className="mt-6 grid gap-4" action="/passport/join">
            <label className="text-sm font-medium text-slate-800">
              Team code
              <input name="code" defaultValue={code} className={inputClass} />
            </label>
            <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
              Look up invite
            </button>
          </form>
        </section>
        {code ? (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            {invite ? (
              <>
                <h2 className="text-xl font-semibold text-slate-950">Invite found for {invite.player_name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Team: {invite.team_name || "Team roster"} {invite.season_name ? `- ${invite.season_name}` : ""}
                </p>
                {userEmail ? (
                  <form action={acceptRosterInviteAction} className="mt-5">
                    <input type="hidden" name="join_code" value={code} />
                    <input type="hidden" name="return_to" value={next} />
                    <button className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                      Accept invite
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Link href={`/account/login?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
                      Sign in to accept
                    </Link>
                    <Link href={`/account/register?next=${encodeURIComponent(next)}`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500">
                      Create account
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm leading-6 text-slate-600">
                No active invite matched that code for the current account email. Check the code or sign in with the email your coach invited.
              </p>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
