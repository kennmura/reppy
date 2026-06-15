import Link from "next/link";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { addPlayerClipAction, reportPassportContentAction, saveAccountPlayerProfileAction } from "@/lib/passportActions";
import type {
  PassportContentReportReason,
  PassportPlayerBundle,
  PassportTeam,
  PlayerClip,
  PlayerFeedbackComment,
  PlayerProfile,
  PublicPlayerProfile,
} from "@/lib/passportTypes";

const primaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:border-slate-500";
const inputClass = "mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950";

export function PassportHeader({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {body ? <p className="mt-2 max-w-2xl leading-7 text-slate-600">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PassportMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold capitalize text-slate-950">{value}</p>
    </div>
  );
}

export function PassportEmptyState({
  title,
  body,
  href,
  label,
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 leading-7 text-slate-600">{body}</p>
      {href && label ? (
        <Link href={href} className="mt-5 inline-flex rounded-md bg-[#12355b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0d2948]">
          {label}
        </Link>
      ) : null}
    </section>
  );
}

export function PlayerPassportCard({ player }: { player: PlayerProfile }) {
  return (
    <Link href={`/account/passport/${player.id}`} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-full bg-[#d7e5dc]">
          {player.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.profile_photo_url} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div>
          <p className="font-semibold text-slate-950">{player.display_name}</p>
          <p className="mt-1 text-sm capitalize text-slate-600">
            {[player.sport, player.position, player.graduation_year ? `Class of ${player.graduation_year}` : null]
              .filter(Boolean)
              .join(" - ")}
          </p>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">
        {player.goals || player.strengths || "Open this passport to add clips, feedback, reflections, and sharing settings."}
      </p>
    </Link>
  );
}

export function PassportTeamCard({ team, href }: { team: PassportTeam; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">{team.sport}</p>
      <h2 className="mt-2 text-xl font-semibold text-slate-950">{team.name}</h2>
      <p className="mt-2 text-sm capitalize text-slate-600">
        {[team.team_type.replaceAll("_", " "), team.season_name, team.age_group].filter(Boolean).join(" - ")}
      </p>
      <p className="mt-4 rounded-md border border-[#d7e5dc] bg-[#f3f8f5] px-3 py-2 text-sm font-semibold text-[#12355b]">
        Join code: {team.join_code}
      </p>
    </Link>
  );
}

export function PlayerProfileForm({ player }: { player?: PlayerProfile | null }) {
  return (
    <form action={saveAccountPlayerProfileAction} className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="player_id" value={player?.id ?? ""} />
      <input type="hidden" name="return_to" value={player ? `/account/passport/${player.id}/edit` : "/account/passport/edit"} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Label text="Player display name" required>
          <input name="display_name" defaultValue={player?.display_name ?? ""} required className={inputClass} />
        </Label>
        <Label text="Sport" required>
          <select name="sport" defaultValue={player?.sport ?? "soccer"} className={inputClass}>
            <option value="soccer">Soccer</option>
            <option value="basketball">Basketball</option>
          </select>
        </Label>
        <Label text="Position">
          <input name="position" defaultValue={player?.position ?? ""} className={inputClass} />
        </Label>
        <Label text="Secondary positions">
          <input name="secondary_positions" defaultValue={player?.secondary_positions?.join(", ") ?? ""} placeholder="Comma separated" className={inputClass} />
        </Label>
        <Label text="Graduation year">
          <input name="graduation_year" type="number" min="2020" max="2045" defaultValue={player?.graduation_year ?? ""} className={inputClass} />
        </Label>
        <Label text="Current team">
          <input name="current_team" defaultValue={player?.current_team ?? ""} className={inputClass} />
        </Label>
        <Label text="Height">
          <input name="height" defaultValue={player?.height ?? ""} placeholder="5'8&quot;" className={inputClass} />
        </Label>
        <Label text="Dominant foot">
          <input name="dominant_foot" defaultValue={player?.dominant_foot ?? ""} placeholder="Right, left, both" className={inputClass} />
        </Label>
        <Label text="Dominant hand">
          <input name="dominant_hand" defaultValue={player?.dominant_hand ?? ""} placeholder="Right, left, both" className={inputClass} />
        </Label>
        <Label text="Playing style">
          <input name="playing_style" defaultValue={player?.playing_style ?? ""} placeholder="Creator, finisher, defender" className={inputClass} />
        </Label>
        <Label text="City">
          <input name="city" defaultValue={player?.city ?? ""} className={inputClass} />
        </Label>
        <Label text="State">
          <input name="state" defaultValue={player?.state ?? ""} className={inputClass} />
        </Label>
        <Label text="Profile photo URL">
          <input name="profile_photo_url" defaultValue={player?.profile_photo_url ?? ""} className={inputClass} />
        </Label>
        <Label text="Banner image URL">
          <input name="banner_image_url" defaultValue={player?.banner_image_url ?? ""} className={inputClass} />
        </Label>
        <Label text="Date of birth">
          <input name="date_of_birth" type="date" defaultValue={player?.date_of_birth ?? ""} className={inputClass} />
        </Label>
        <Label text="Parent email">
          <input name="parent_email" type="email" className={inputClass} />
        </Label>
      </div>
      <Label text="Player-written strengths">
        <textarea name="strengths" defaultValue={player?.strengths ?? ""} rows={3} className={inputClass} />
      </Label>
      <Label text="Goals">
        <textarea name="goals" defaultValue={player?.goals ?? ""} rows={3} className={inputClass} />
      </Label>
      <Label text="Achievements">
        <textarea name="achievements" defaultValue={player?.achievements ?? ""} rows={3} className={inputClass} />
      </Label>
      <Label text="Short bio">
        <textarea name="bio" defaultValue={player?.bio ?? ""} rows={4} className={inputClass} />
      </Label>
      <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
        <Check name="is_minor" defaultChecked={player?.is_minor ?? true} label="This profile is for a minor athlete" />
        <Check name="visibility_public" defaultChecked={player?.visibility === "public"} label="Make profile public when safe" />
        <Check name="team_names_public" defaultChecked={player?.team_names_public ?? false} label="Show team names publicly" />
        <Check name="height_public" defaultChecked={player?.height_public ?? false} label="Show height publicly" />
        <Check name="location_public" defaultChecked={player?.location_public ?? false} label="Show city/state publicly" />
      </div>
      <PendingSubmitButton idleLabel="Save Passport" pendingLabel="Saving..." className={primaryButton} />
    </form>
  );
}

export function ClipForm({
  playerId,
  returnTo,
  source = "player_upload",
  teamId,
}: {
  playerId: string;
  returnTo: string;
  source?: "player_upload" | "coach_upload";
  teamId?: string | null;
}) {
  return (
    <form action={addPlayerClipAction} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="player_profile_id" value={playerId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="team_id" value={teamId ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Label text="Clip title" required>
          <input name="title" required className={inputClass} />
        </Label>
        <Label text="Clip type">
          <select name="clip_type" className={inputClass}>
            <option value="game">Game</option>
            <option value="workout">Workout</option>
            <option value="training">Training</option>
            <option value="practice">Practice</option>
            <option value="highlight">Highlight</option>
          </select>
        </Label>
        <Label text="Duration seconds">
          <input name="duration_seconds" type="number" min="0" max="15" className={inputClass} />
        </Label>
        {source === "player_upload" ? (
          <Label text="Visibility">
            <select name="visibility" className={inputClass}>
              <option value="private">Private</option>
              <option value="connected_coaches">Connected coaches only</option>
              <option value="public">Public profile</option>
            </select>
          </Label>
        ) : null}
        <Label text="Video URL or storage path">
          <input name="public_url" placeholder="Public URL for MVP, or save storage path later" className={inputClass} />
        </Label>
        <Label text="Thumbnail URL">
          <input name="thumbnail_url" className={inputClass} />
        </Label>
      </div>
      <Label text="Description">
        <textarea name="description" rows={3} className={inputClass} />
      </Label>
      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
        MVP clips are limited to 15 seconds and 4 active {source === "coach_upload" ? "coach-uploaded" : "player-uploaded"} clips per player.
      </p>
      <PendingSubmitButton idleLabel="Add clip" pendingLabel="Adding..." className={primaryButton} />
    </form>
  );
}

export function ClipGrid({ clips }: { clips: PlayerClip[] }) {
  if (!clips.length) {
    return <PassportEmptyState title="No clips yet" body="Clips added to this passport will appear here." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {clips.map((clip) => (
        <article key={clip.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="aspect-video overflow-hidden rounded-md bg-slate-100">
            {clip.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clip.thumbnail_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">Clip</div>
            )}
          </div>
          <h3 className="mt-4 font-semibold text-slate-950">{clip.title}</h3>
          <p className="mt-1 text-sm capitalize text-slate-600">
            {[clip.clip_type, clip.source.replace("_", " "), clip.visibility.replace("_", " "), `${clip.duration_seconds ?? "?"} sec`]
              .filter(Boolean)
              .join(" - ")}
          </p>
          {clip.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{clip.description}</p> : null}
          {clip.public_url ? (
            <a href={clip.public_url} className="mt-3 inline-flex text-sm font-semibold text-[#12355b] hover:text-[#0d2948]">
              Open clip
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function FeedbackList({ feedback }: { feedback: PlayerFeedbackComment[] }) {
  if (!feedback.length) {
    return <PassportEmptyState title="No coach feedback yet" body="Connected coaches can add fast, private development feedback here." />;
  }

  return (
    <div className="grid gap-3">
      {feedback.map((item) => (
        <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6f5e]">{item.comment_type.replaceAll("_", " ")}</p>
          <p className="mt-2 leading-7 text-slate-800">{item.body}</p>
          {[item.player_strength_observed, item.improvement_area, item.recommended_drill].filter(Boolean).length ? (
            <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
              {item.player_strength_observed ? <p><span className="font-semibold text-slate-950">Strength:</span> {item.player_strength_observed}</p> : null}
              {item.improvement_area ? <p><span className="font-semibold text-slate-950">Improve:</span> {item.improvement_area}</p> : null}
              {item.recommended_drill ? <p><span className="font-semibold text-slate-950">Drill:</span> {item.recommended_drill}</p> : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function PublicPlayerProfileView({ profile }: { profile: PublicPlayerProfile }) {
  const location = profile.location_public ? [profile.city, profile.state].filter(Boolean).join(", ") : null;
  return (
    <main className="bg-slate-50 pb-16">
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="h-48 overflow-hidden rounded-lg bg-[#d7e5dc] sm:h-64">
            {profile.banner_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.banner_image_url} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-slate-200">
                {profile.profile_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.profile_photo_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="pb-2">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2f6f5e]">Reppy Passport</p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{profile.display_name}</h1>
                <p className="mt-1 text-sm capitalize text-slate-600">
                  {[profile.sport, profile.position, profile.graduation_year ? `Class of ${profile.graduation_year}` : null, location]
                    .filter(Boolean)
                    .join(" - ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">About</h2>
            <p className="mt-3 leading-7 text-slate-700">{profile.bio || "This player has not added a public bio yet."}</p>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Public clips</h2>
            <div className="mt-4">
              <ClipGrid clips={profile.publicClips} />
            </div>
          </section>
        </div>
        <aside className="space-y-4">
          <InfoCard title="Strengths" body={profile.strengths || "Not shared publicly yet."} />
          <InfoCard title="Achievements" body={profile.achievements || "Not shared publicly yet."} />
          <InfoCard title="Timeline" body={profile.publicTimeline.length ? `${profile.publicTimeline.length} public updates` : "No public timeline updates yet."} />
          <ReportContentForm
            playerId={profile.id}
            contentType="player_profile"
            contentId={profile.id}
            returnTo={profile.slug ? `/players/${profile.slug}` : "/"}
          />
        </aside>
      </div>
    </main>
  );
}

export function ReportContentForm({
  playerId,
  contentType,
  contentId,
  returnTo,
  reporterRole = "account",
}: {
  playerId?: string | null;
  contentType: string;
  contentId?: string | null;
  returnTo: string;
  reporterRole?: "account" | "coach";
}) {
  const reasons: Array<{ value: PassportContentReportReason; label: string }> = [
    { value: "inappropriate_content", label: "Inappropriate content" },
    { value: "harassment", label: "Harassment" },
    { value: "bullying", label: "Bullying" },
    { value: "private_information", label: "Private information" },
    { value: "false_information", label: "False information" },
    { value: "unsafe_adult_minor_communication", label: "Unsafe adult/minor communication" },
    { value: "spam", label: "Spam" },
    { value: "other", label: "Other" },
  ];

  return (
    <form action={reportPassportContentAction} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="player_profile_id" value={playerId ?? ""} />
      <input type="hidden" name="content_type" value={contentType} />
      <input type="hidden" name="content_id" value={contentId ?? ""} />
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="reporter_role" value={reporterRole} />
      <p className="text-sm font-semibold text-slate-950">Report safety issue</p>
      <select name="reason" className={inputClass}>
        {reasons.map((reason) => (
          <option key={reason.value} value={reason.value}>{reason.label}</option>
        ))}
      </select>
      <textarea name="details" rows={3} placeholder="Optional context for admin moderation" className={inputClass} />
      <button className="mt-3 inline-flex rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500">
        Report
      </button>
    </form>
  );
}

export function PassportBundleOverview({ bundle }: { bundle: PassportPlayerBundle }) {
  const playerClips = bundle.clips.filter((clip) => clip.source === "player_upload" && clip.status === "active");
  const coachClips = bundle.clips.filter((clip) => clip.source === "coach_upload" && clip.status === "active");
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <PassportMetric label="Teams" value={bundle.teams.length} />
      <PassportMetric label="Player clips" value={`${playerClips.length}/4`} />
      <PassportMetric label="Coach clips" value={`${coachClips.length}/4`} />
      <PassportMetric label="Focus areas" value={bundle.focuses.filter((focus) => focus.status === "active").length} />
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </section>
  );
}

function Label({ text, required, children }: { text: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="text-sm font-medium text-slate-800">
      {text}
      {required ? <span className="text-red-600"> *</span> : null}
      {children}
    </label>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-2">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1 h-4 w-4 rounded border-slate-300" />
      <span>{label}</span>
    </label>
  );
}

export { inputClass, primaryButton, secondaryButton };
