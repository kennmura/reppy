import Link from "next/link";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { repairAccountForAuthUser } from "@/lib/auth";
import { getReviewInviteByToken } from "@/lib/data";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function InvitedReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const context = await getReviewInviteByToken(token);

  if (!context) {
    return <ReviewMessage title="Review invite unavailable" body="This review invite could not be found." />;
  }

  const { invite, coach } = context;
  const expired = invite.expires_at ? invite.expires_at < currentIso() : false;

  if (expired || invite.status === "expired" || invite.status === "revoked") {
    return <ReviewMessage title="Review invite expired" body="Ask the coach for a new review invite." coachSlug={coach.slug} />;
  }

  if (invite.status === "completed") {
    return <ReviewMessage title="Review already submitted" body="This invite has already been used." coachSlug={coach.slug} />;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    const next = `/reviews/${token}`;
    return (
      <ReviewShell>
        <div className="grid gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Leave a review for {coach.full_name}</h1>
          <p className="leading-7 text-slate-700">
            Reviews are account-based. Create a lightweight Reppy account or sign in with the invited email address.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href={`/account/register?mode=review&next=${encodeURIComponent(next)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
            >
              Create review account
            </Link>
            <Link
              href={`/account/login?next=${encodeURIComponent(next)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:border-slate-500"
            >
              Sign in
            </Link>
          </div>
        </div>
      </ReviewShell>
    );
  }

  const { profile } = await repairAccountForAuthUser(user);

  if (!profile || !["parent", "adult_player"].includes(profile.role)) {
    return <ReviewMessage title="Use a player or parent account" body="Coach accounts cannot leave reviews." coachSlug={coach.slug} />;
  }

  if (!user.email_confirmed_at && !profile.email_verified_at) {
    return (
      <ReviewMessage
        title="Verify your email"
        body="Open the Supabase confirmation email before submitting a review."
        coachSlug={coach.slug}
      />
    );
  }

  if ((user.email ?? "").toLowerCase() !== invite.invited_email_normalized) {
    return (
      <ReviewMessage
        title="Use the invited email"
        body="This invite is tied to a specific email address. Sign in with that email or ask the coach for a new invite."
        coachSlug={coach.slug}
      />
    );
  }

  if (invite.status === "sent") {
    await createSupabaseAdminClient()
      .from("coach_review_invites")
      .update({ status: "opened", updated_at: new Date().toISOString() })
      .eq("id", invite.id)
      .eq("status", "sent");
  }

  return (
    <ReviewShell>
      <div className="grid gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#2f6f5e]">Invited client review</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Review {coach.full_name}</h1>
          <p className="mt-3 leading-7 text-slate-700">
            Your public reviewer label will be privacy-safe, such as Parent of U12 player or Adult player.
          </p>
        </div>
        <ReviewForm coach={coach} inviteToken={token} reviewType="invited_client" />
      </div>
    </ReviewShell>
  );
}

function currentIso() {
  return new Date().toISOString();
}

function ReviewShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-[#f7f8f3] py-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Link href="/coaches" className="text-sm font-semibold text-[#12355b]">
            Find coaches
          </Link>
          <div className="mt-6">{children}</div>
          <p className="mt-6 text-xs leading-5 text-slate-500">
            Reppy moderates reviews for spam, harassment, private contact information, and youth-safety issues before publishing.
          </p>
        </div>
      </div>
    </main>
  );
}

function ReviewMessage({ title, body, coachSlug }: { title: string; body: string; coachSlug?: string }) {
  return (
    <ReviewShell>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-3 leading-7 text-slate-700">{body}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {coachSlug ? (
          <Link
            href={`/coaches/${coachSlug}`}
            className="rounded-md bg-[#12355b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0d2948]"
          >
            View coach profile
          </Link>
        ) : null}
        <Link
          href="/coaches"
          className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:border-slate-500"
        >
          Browse coaches
        </Link>
      </div>
    </ReviewShell>
  );
}
