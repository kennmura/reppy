import { submitCoachReviewAction } from "@/lib/reviewActions";
import type { Coach } from "@/lib/types";

const tags = [
  "Great with kids",
  "Technical training",
  "Reliable",
  "Clear communication",
  "Good value",
  "Motivating",
  "Professional",
  "Tactical insight",
  "Fitness",
  "College guidance",
];

export function ReviewForm({
  coach,
  inviteToken,
  trainingRequestId,
  reviewType,
}: {
  coach: Coach;
  inviteToken?: string;
  trainingRequestId?: string;
  reviewType: "invited_client" | "verified_session";
}) {
  return (
    <form action={submitCoachReviewAction} className="grid gap-5">
      <input type="hidden" name="coach_id" value={coach.id} />
      <input type="hidden" name="invite_token" value={inviteToken ?? ""} />
      <input type="hidden" name="training_request_id" value={trainingRequestId ?? ""} />
      <div className="rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-4 py-3 text-sm text-slate-700">
        {reviewType === "verified_session" ? "Verified Reppy session review" : "Invited client review"}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RatingField label="Overall rating" name="overall_rating" required />
        <RatingField label="Communication" name="communication_rating" />
        <RatingField label="Reliability" name="reliability_rating" />
        <RatingField label="Training quality" name="training_quality_rating" />
      </div>
      <label className="text-sm font-medium text-slate-800">
        Review title
        <input
          name="review_title"
          maxLength={120}
          placeholder="Optional short headline"
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
        />
      </label>
      <label className="text-sm font-medium text-slate-800">
        Review
        <textarea
          name="review_body"
          required
          minLength={20}
          rows={6}
          placeholder={`Share what training with ${coach.full_name} was like. Do not include private contact details, medical info, exact locations, or a minor player's full name.`}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">
          Relationship
          <select
            name="reviewer_relationship"
            required
            defaultValue="parent_guardian"
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
          >
            <option value="parent_guardian">Parent/guardian</option>
            <option value="player">Player</option>
            <option value="adult_player">Adult player</option>
            <option value="former_player">Former player</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          Player age band
          <select
            name="player_age_band"
            defaultValue=""
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
          >
            <option value="">Prefer not to say</option>
            <option value="U8">U8</option>
            <option value="U10">U10</option>
            <option value="U12">U12</option>
            <option value="U14">U14</option>
            <option value="high_school">High school</option>
            <option value="college">College</option>
            <option value="adult">Adult</option>
          </select>
        </label>
      </div>
      <label className="text-sm font-medium text-slate-800">
        Training type
        <input
          name="training_type"
          maxLength={120}
          placeholder="Private training, small group, team session..."
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
        />
      </label>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium text-slate-800">Tags</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {tags.map((tag) => (
            <label key={tag} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <input name="tags" type="checkbox" value={tag} />
              {tag}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Reviews are account-based and moderated. Reppy does not show your email address or private player details publicly.
      </p>
      <button className="w-fit rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
        Submit review
      </button>
    </form>
  );
}

function RatingField({ label, name, required = false }: { label: string; name: string; required?: boolean }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {label}
      <select
        name={name}
        required={required}
        defaultValue={required ? "5" : ""}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-[#12355b] focus:ring-2 focus:ring-[#12355b]/15"
      >
        <option value="">{required ? "Select rating" : "Optional"}</option>
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Very good</option>
        <option value="3">3 - Good</option>
        <option value="2">2 - Needs improvement</option>
        <option value="1">1 - Poor</option>
      </select>
    </label>
  );
}
