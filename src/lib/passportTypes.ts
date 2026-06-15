export type PassportSport = "soccer" | "basketball";
export type PlayerProfileVisibility = "public" | "private";
export type PassportTeamType = "high_school" | "club" | "private_training_group" | "other";
export type PassportMemberRole = "head_coach" | "assistant_coach" | "support_coach" | "player" | "parent";
export type RosterInviteStatus = "draft" | "sent" | "accepted" | "revoked" | "expired";
export type PlayerClipSource = "player_upload" | "coach_upload";
export type PlayerClipVisibility = "public" | "connected_coaches" | "private";
export type PlayerClipStatus = "active" | "archived" | "reported" | "removed";
export type PassportContentReportReason =
  | "inappropriate_content"
  | "harassment"
  | "bullying"
  | "private_information"
  | "false_information"
  | "unsafe_adult_minor_communication"
  | "spam"
  | "other";

export type PlayerProfile = {
  id: string;
  user_id: string | null;
  slug: string | null;
  display_name: string;
  profile_photo_url: string | null;
  banner_image_url: string | null;
  sport: PassportSport;
  position: string | null;
  secondary_positions: string[];
  graduation_year: number | null;
  current_team: string | null;
  achievements: string | null;
  strengths: string | null;
  goals: string | null;
  height: string | null;
  dominant_foot: string | null;
  dominant_hand: string | null;
  position_group: string | null;
  preferred_side: string | null;
  playing_style: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  visibility: PlayerProfileVisibility;
  team_names_public: boolean;
  height_public: boolean;
  location_public: boolean;
  is_minor: boolean;
  date_of_birth?: string | null;
  private_notes?: string | null;
  status: "active" | "hidden" | "removed";
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerProfileEmail = {
  id: string;
  player_profile_id: string;
  email_normalized: string;
  email_type: "school" | "personal" | "parent";
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type PlayerParentLink = {
  id: string;
  player_profile_id: string;
  parent_user_id: string | null;
  parent_email_normalized: string | null;
  relationship: "parent_guardian" | "guardian" | "caregiver";
  status: "invited" | "active" | "revoked";
  invited_by_user_id: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PassportTeam = {
  id: string;
  coach_user_id: string;
  coach_id: string | null;
  name: string;
  sport: PassportSport;
  team_type: PassportTeamType;
  season_name: string | null;
  age_group: string | null;
  school_or_club: string | null;
  city: string | null;
  state: string | null;
  join_code: string;
  status: "active" | "archived" | "removed";
  created_at: string;
  updated_at: string;
};

export type PassportTeamMember = {
  id: string;
  team_id: string;
  user_id: string | null;
  player_profile_id: string | null;
  member_role: PassportMemberRole;
  staff_role: "head" | "assistant" | "support" | null;
  status: "active" | "invited" | "left" | "removed";
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PassportRosterInvite = {
  id: string;
  team_id: string;
  player_profile_id: string | null;
  player_name: string;
  parent_email_normalized: string | null;
  player_school_email_normalized: string | null;
  player_personal_email_normalized: string | null;
  position: string | null;
  jersey_number: string | null;
  graduation_year: number | null;
  height: string | null;
  team_name: string | null;
  season_name: string | null;
  coach_notes: string | null;
  invite_token: string;
  join_code: string;
  status: RosterInviteStatus;
  accepted_by_user_id: string | null;
  accepted_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerClip = {
  id: string;
  player_profile_id: string;
  uploaded_by_user_id: string;
  uploaded_by_role: "player" | "parent" | "team_coach" | "assistant_coach" | "private_coach" | "admin";
  team_id: string | null;
  title: string;
  description: string | null;
  clip_type: "game" | "workout" | "training" | "practice" | "highlight";
  storage_path: string | null;
  public_url: string | null;
  thumbnail_url: string | null;
  visibility: PlayerClipVisibility;
  source: PlayerClipSource;
  duration_seconds: number | null;
  status: PlayerClipStatus;
  created_at: string;
  updated_at: string;
};

export type PlayerClipComment = {
  id: string;
  clip_id: string;
  player_profile_id: string;
  author_user_id: string;
  team_id: string | null;
  body: string;
  comment_type: string;
  visibility: string;
  status: "active" | "reported" | "hidden" | "removed";
  created_at: string;
  updated_at: string;
};

export type PlayerFeedbackComment = {
  id: string;
  player_profile_id: string;
  author_user_id: string;
  team_id: string | null;
  clip_id: string | null;
  reflection_id: string | null;
  focus_area_id: string | null;
  comment_type: string;
  body: string;
  player_strength_observed: string | null;
  improvement_area: string | null;
  recommended_drill: string | null;
  visibility: string;
  status: "active" | "reported" | "hidden" | "removed";
  created_at: string;
  updated_at: string;
};

export type PlayerDevelopmentFocus = {
  id: string;
  player_profile_id: string;
  team_id: string | null;
  created_by_user_id: string;
  focus_area: string;
  description: string | null;
  priority: number;
  visibility: string;
  status: "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
};

export type PlayerGameReflection = {
  id: string;
  player_profile_id: string;
  team_id: string | null;
  created_by_user_id: string;
  game_date: string | null;
  did_well: string;
  struggled_with: string;
  improvement_focus: string;
  visibility: string;
  status: "active" | "reported" | "hidden" | "removed";
  created_at: string;
  updated_at: string;
};

export type PlayerHandoffSummary = {
  id: string;
  player_profile_id: string;
  team_id: string | null;
  generated_by_user_id: string;
  summary_mode: "manual" | "generated_draft";
  strengths: string | null;
  improvement_areas: string | null;
  recommended_focus: string | null;
  coach_summary: string | null;
  next_season_notes: string | null;
  internal_staff_notes?: string | null;
  visibility: string;
  status: "draft" | "published" | "hidden" | "removed";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlayerProfileAccess = {
  id: string;
  player_profile_id: string;
  granted_to_user_id: string;
  granted_by_user_id: string | null;
  access_level: "view_development" | "comment_feedback" | "team_staff" | "private_trainer";
  scope: "full_passport" | "team_only" | "current_season" | "specific_clip";
  status: "active" | "revoked";
  created_at: string;
  revoked_at: string | null;
};

export type PlayerTimelineEvent = {
  id: string;
  player_profile_id: string;
  team_id: string | null;
  actor_user_id: string | null;
  event_type: string;
  title: string;
  body: string | null;
  source_table: string | null;
  source_id: string | null;
  visibility: string;
  status: "active" | "hidden" | "removed";
  occurred_at: string;
  created_at: string;
};

export type PassportContentReport = {
  id: string;
  reporter_user_id: string;
  player_profile_id: string | null;
  content_type: "player_profile" | "clip" | "clip_comment" | "feedback" | "handoff_summary" | "reflection" | "focus_area";
  content_id: string | null;
  reason: PassportContentReportReason;
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicPlayerProfile = Pick<
  PlayerProfile,
  | "id"
  | "slug"
  | "display_name"
  | "profile_photo_url"
  | "banner_image_url"
  | "sport"
  | "position"
  | "secondary_positions"
  | "graduation_year"
  | "current_team"
  | "achievements"
  | "strengths"
  | "height"
  | "bio"
  | "city"
  | "state"
  | "team_names_public"
  | "height_public"
  | "location_public"
  | "created_at"
  | "updated_at"
> & {
  publicClips: PlayerClip[];
  publicTimeline: PlayerTimelineEvent[];
};

export type PassportPlayerBundle = {
  profile: PlayerProfile;
  emails: PlayerProfileEmail[];
  parentLinks: PlayerParentLink[];
  teams: Array<PassportTeam & { member: PassportTeamMember }>;
  clips: PlayerClip[];
  clipComments: PlayerClipComment[];
  feedback: PlayerFeedbackComment[];
  focuses: PlayerDevelopmentFocus[];
  reflections: PlayerGameReflection[];
  handoffs: PlayerHandoffSummary[];
  accessGrants: PlayerProfileAccess[];
  timeline: PlayerTimelineEvent[];
};

export type CoachPassportTeamBundle = {
  team: PassportTeam;
  members: PassportTeamMember[];
  invites: PassportRosterInvite[];
  players: PlayerProfile[];
};

export type CoachPassportDashboard = {
  teams: PassportTeam[];
  invites: PassportRosterInvite[];
  playerCount: number;
  pendingInviteCount: number;
};

export type AccountPassportDashboard = {
  players: PlayerProfile[];
  parentLinkedPlayers: PlayerProfile[];
  invites: PassportRosterInvite[];
};

export type AdminPassportDashboard = {
  players: PlayerProfile[];
  teams: PassportTeam[];
  reports: PassportContentReport[];
  invites: PassportRosterInvite[];
};
