export type Coach = {
  id: string;
  user_id?: string | null;
  slug: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  sport: string | null;
  category: string | null;
  headline: string | null;
  bio: string | null;
  playing_experience?: string | null;
  coaching_experience?: string | null;
  current_affiliation?: string | null;
  years_experience?: number | null;
  training_approach?: string | null;
  age_groups?: string | null;
  skill_levels?: string | null;
  positions?: string | null;
  training_format?: string | null;
  general_availability?: string | null;
  location: string | null;
  public_location?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_miles?: number | null;
  service_radius_miles?: number | null;
  service_area: string | null;
  pricing_text: string | null;
  profile_photo_url: string | null;
  banner_image_url: string | null;
  instagram_url: string | null;
  video_url: string | null;
  booking_url: string | null;
  is_published: boolean;
  is_featured: boolean;
  accepting_requests?: boolean | null;
  profile_status?: CoachProfileStatus | null;
  profile_completion?: number | null;
  onboarding_step?: number | null;
  onboarding_completed_at?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  founding_price_locked?: boolean | null;
  contact_scan_status?: string | null;
  admin_premium_access_until?: string | null;
  referral_code?: string | null;
  subscription_status: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachService = {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  duration: string | null;
  price: string | null;
  format?: string | null;
  level?: string | null;
  is_featured?: boolean | null;
  sort_order: number;
  created_at: string;
  updated_at?: string | null;
};

export type CoachProfileStatus =
  | "draft"
  | "pending_review"
  | "published"
  | "changes_requested"
  | "rejected"
  | "suspended";

export type UserRole = "coach" | "parent" | "adult_player" | "admin";

export type AccountStatus = "active" | "pending" | "suspended" | "banned" | "deleted";

export type UserProfile = {
  id: string;
  role: UserRole;
  display_name: string;
  account_status: AccountStatus;
  email_verified_at: string | null;
  phone_verified_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type AccountPrivateDetails = {
  user_id: string;
  phone_e164: string | null;
  phone_verified_at: string | null;
  account_type: "parent" | "adult_player" | null;
  otp_send_count: number;
  otp_verify_attempt_count: number;
  otp_last_sent_at: string | null;
  otp_window_started_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachCredential = {
  id: string;
  coach_id: string;
  title: string;
  organization: string | null;
  description: string | null;
  year: number | null;
  sort_order: number;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type CoachAudience = {
  id: string;
  coach_id: string;
  label: string;
  sort_order: number;
  created_at: string;
};

export type CoachTestimonial = {
  id: string;
  coach_id: string;
  quote: string;
  author: string | null;
  sort_order: number;
  created_at: string;
};

export type TrainingRequest = {
  id: string;
  coach_id: string | null;
  coach_slug: string | null;
  name: string;
  email: string;
  phone: string | null;
  player_age: string | null;
  current_level: string | null;
  training_goals: string;
  preferred_location: string | null;
  preferred_days_times: string | null;
  message: string | null;
  status: "new" | "contacted" | "scheduled" | "closed";
  conversation_id?: string | null;
  is_minor?: boolean | null;
  guardian_name?: string | null;
  guardian_required?: boolean | null;
  guardian_confirmed_at?: string | null;
  parent_follow_up_sent_at?: string | null;
  created_at: string;
};

export type CoachApplication = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  sport: string;
  location: string;
  coaching_focus: string | null;
  background: string;
  message: string | null;
  status: "new" | "reviewing" | "approved" | "closed";
  created_at: string;
};

export type SubscriptionStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "canceling"
  | "canceled"
  | "expired";

export type MessageAccess = {
  hasAccess: boolean;
  reason: "subscription" | "trial" | "grant" | "admin" | "none";
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  accessEndsAt: string | null;
  foundingPriceLocked: boolean;
};

export type PremiumAccessGrant = {
  id: string;
  coach_user_id: string | null;
  coach_id?: string | null;
  user_id?: string | null;
  grant_type: string;
  starts_at: string;
  ends_at: string | null;
  referral_id?: string | null;
  granted_by?: string | null;
  is_active?: boolean | null;
  notes?: string | null;
  created_at: string;
};

export type SavedCoach = {
  id: string;
  user_id: string;
  coach_id: string;
  notes: string | null;
  created_at: string;
};

export type CoachReview = {
  id: string;
  coach_id: string;
  reviewer_user_id: string | null;
  conversation_id: string | null;
  rating: number;
  headline: string | null;
  body: string | null;
  status: "pending" | "approved" | "rejected" | "reported" | "hidden";
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type ConversationStatus =
  | "new"
  | "replied"
  | "scheduled"
  | "completed"
  | "declined"
  | "archived"
  | "spam";

export type ConversationSafeMetadata = {
  id: string;
  coach_id: string | null;
  coach_user_id: string | null;
  sport: string | null;
  request_type: string | null;
  age_range: string | null;
  general_location: string | null;
  status: ConversationStatus;
  is_unread_by_coach: boolean;
  participant_unread_count?: number;
  participant_archived?: boolean;
  is_saved: boolean;
  retention_expires_at?: string | null;
  free_coach_alert_sent_at?: string | null;
  free_coach_alert_attempted_at?: string | null;
  free_coach_alert_error?: string | null;
  parent_follow_up_sent_at: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

export type ConversationPrivateDetails = {
  conversation_id: string;
  requester_display_name: string | null;
  requester_email?: string | null;
  requester_phone?: string | null;
  guardian_name: string | null;
  guardian_email?: string | null;
  guardian_phone?: string | null;
  exact_location?: string | null;
  preferred_days_times: string | null;
  current_level: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_role: "coach" | "parent" | "player" | "admin" | "system";
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type ConversationThread = {
  conversation: ConversationSafeMetadata;
  privateDetails: ConversationPrivateDetails | null;
  messages: Message[];
};

export type NotificationType =
  | "new_training_request"
  | "new_message"
  | "coach_replied"
  | "profile_approved"
  | "profile_changes_requested"
  | "request_unanswered"
  | "trial_expiring"
  | "subscription_locked"
  | "referral_reward"
  | "system";

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  related_conversation_id: string | null;
  action_url: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationPreference = {
  user_id: string;
  in_app_enabled: boolean;
  push_enabled: boolean;
  free_coach_email_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type PlayerRecord = {
  id: string;
  coach_user_id: string | null;
  coach_id: string | null;
  source_conversation_id: string | null;
  player_user_id: string | null;
  display_name: string;
  birth_date: string | null;
  birth_year: number | null;
  sport: string | null;
  position: string | null;
  current_level: string | null;
  current_team: string | null;
  training_goals: string | null;
  coach_notes: string | null;
  first_session_date: string | null;
  last_session_date: string | null;
  session_count: number;
  status: "prospective" | "active" | "inactive" | "completed";
  guardian_involved: boolean;
  created_at: string;
  updated_at: string;
};

export type CoachProfileData = {
  coach: Coach;
  services: CoachService[];
  audiences: CoachAudience[];
  testimonials: CoachTestimonial[];
  credentials?: CoachCredential[];
};

export type UserCoachingPreference = {
  user_id: string;
  sport: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  search_radius_miles: number | null;
  age_group: string | null;
  skill_level: string | null;
  position: string | null;
  training_goals: string | null;
  price_min: number | null;
  price_max: number | null;
  training_format: string | null;
  preferred_days: string | null;
  created_at: string;
  updated_at: string;
};
