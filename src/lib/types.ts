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
  timezone?: string | null;
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
  coach_direct_preferred?: boolean | null;
  platform_payment_allowed?: boolean | null;
  platform_payment_required?: boolean | null;
  stripe_connected_account_id?: string | null;
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

export type AdminAuthUserSummary = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
};

export type AdminAccountSummary = UserProfile & {
  auth_user: AdminAuthUserSummary | null;
};

export type AdminAccountDetail = {
  profile: UserProfile;
  privateDetails: AccountPrivateDetails | null;
  preference: UserCoachingPreference | null;
  conversations: ConversationSafeMetadata[];
  savedCoaches: Coach[];
  authUser: AdminAuthUserSummary | null;
};

export type AccountPrivateDetails = {
  user_id: string;
  phone_e164: string | null;
  phone_verified_at: string | null;
  player_date_of_birth?: string | null;
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

export type CoachAvailabilityBlock = {
  id: string;
  coach_id: string;
  coach_user_id: string | null;
  availability_date: string;
  start_time: string;
  end_time: string;
  timezone: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingRequest = {
  id: string;
  coach_id: string | null;
  coach_slug: string | null;
  requester_user_id?: string | null;
  guardian_user_id?: string | null;
  client_request_id?: string | null;
  service_id?: string | null;
  service_title?: string | null;
  service_description?: string | null;
  name: string;
  email: string;
  phone: string | null;
  player_age: string | null;
  player_age_at_request?: number | null;
  current_level: string | null;
  training_goals: string;
  preferred_location: string | null;
  preferred_days_times: string | null;
  message: string | null;
  status: TrainingRequestStatus;
  payment_status?: TrainingPaymentStatus | null;
  payment_method?: "platform" | "coach_direct" | null;
  gross_amount_cents?: number | null;
  platform_fee_cents?: number | null;
  coach_payout_cents?: number | null;
  currency?: string | null;
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  paid_confirmed_at?: string | null;
  refunded_at?: string | null;
  conversation_id?: string | null;
  selected_availability_block_id?: string | null;
  requested_date?: string | null;
  requested_start_time?: string | null;
  requested_end_time?: string | null;
  timezone?: string | null;
  is_minor?: boolean | null;
  guardian_name?: string | null;
  guardian_required?: boolean | null;
  guardian_confirmed_at?: string | null;
  parent_follow_up_sent_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type TrainingRequestStatus =
  | "pending"
  | "accepted_pending_payment"
  | "paid_confirmed"
  | "declined"
  | "cancelled"
  | "completed"
  | "refunded";

export type TrainingPaymentStatus =
  | "not_required"
  | "requires_payment"
  | "checkout_created"
  | "paid"
  | "coach_direct_pending"
  | "coach_marked_paid"
  | "failed"
  | "expired"
  | "refunded";

export type TrainingSession = {
  id: string;
  training_request_id: string | null;
  conversation_id: string | null;
  coach_id: string | null;
  coach_user_id: string | null;
  requester_user_id: string | null;
  service_id: string | null;
  service_title: string | null;
  session_kind: "first_session" | "future_session";
  status:
    | "requested"
    | "accepted_pending_payment"
    | "paid_confirmed"
    | "direct_payment_pending"
    | "confirmed"
    | "declined"
    | "cancelled"
    | "completed"
    | "refunded";
  payment_status: TrainingPaymentStatus;
  payment_method: "platform" | "coach_direct" | null;
  requested_date: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  timezone: string | null;
  preferred_days_times: string | null;
  location: string | null;
  notes: string | null;
  gross_amount_cents: number | null;
  platform_fee_cents: number | null;
  coach_payout_cents: number | null;
  currency: string;
  paid_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingRequestPayment = {
  id: string;
  training_request_id: string | null;
  training_session_id: string | null;
  conversation_id: string | null;
  coach_id: string | null;
  coach_user_id: string | null;
  requester_user_id: string | null;
  service_id: string | null;
  service_title: string | null;
  session_kind: "first_session" | "future_session";
  payment_method: "platform" | "coach_direct";
  status: Exclude<TrainingPaymentStatus, "not_required">;
  gross_amount_cents: number;
  platform_fee_cents: number;
  coach_payout_cents: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_payment_status: string | null;
  checkout_url: string | null;
  requested_date: string | null;
  requested_start_time: string | null;
  requested_end_time: string | null;
  timezone: string | null;
  metadata: Record<string, unknown>;
  paid_at: string | null;
  failed_at: string | null;
  expired_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainingRequestBundle = {
  request: TrainingRequest | null;
  coach: Coach | null;
  payments: TrainingRequestPayment[];
  sessions: TrainingSession[];
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

export type CoachOfferType = "free_premium" | "founding_599";

export type CoachOfferDurationType = "three_months" | "six_months" | "twelve_months" | "lifetime";

export type CoachAccessOfferStatus = "unclaimed" | "claimed" | "active" | "expired" | "revoked" | "redeemed";

export type CoachAccessOffer = {
  id: string;
  normalized_email: string;
  user_id: string | null;
  coach_id: string | null;
  offer_type: CoachOfferType;
  plan_code: "premium" | "founding_599";
  duration_type: CoachOfferDurationType;
  duration_months: number | null;
  starts_at: string;
  expires_at: string | null;
  is_lifetime: boolean;
  max_redemptions: number;
  redeemed_count: number;
  redeemed_at: string | null;
  revoked_at: string | null;
  invite_token: string | null;
  source: "admin" | "csv_upload" | "invite_link" | "referral" | "ambassador";
  stripe_price_id: string | null;
  stripe_subscription_schedule_id: string | null;
  stripe_subscription_id: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by?: string | null;
  revoked_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachAccessOfferWithClaim = CoachAccessOffer & {
  claimed_user_email?: string | null;
  claimed_coach_name?: string | null;
};

export type Subscription = {
  id: string;
  coach_user_id: string | null;
  coach_id?: string | null;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  plan_code: string;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  access_ends_at: string | null;
  founding_price_locked: boolean | null;
  coach_access_offer_id?: string | null;
  stripe_price_id?: string | null;
  stripe_subscription_schedule_id?: string | null;
  stripe_checkout_session_id?: string | null;
  last_invoice_status?: string | null;
  created_at: string;
  updated_at: string;
};

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
  coach_access_offer_id?: string | null;
  grant_type: string;
  starts_at: string;
  ends_at: string | null;
  referral_id?: string | null;
  granted_by?: string | null;
  is_active?: boolean | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
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
  reviewer_user_id: string;
  conversation_id?: string | null;
  training_request_id: string | null;
  training_session_id: string | null;
  review_invite_id: string | null;
  review_type: "invited_client" | "verified_session";
  status: "pending" | "published" | "hidden" | "reported" | "removed";
  rating?: number;
  headline?: string | null;
  body?: string | null;
  overall_rating: number;
  communication_rating: number | null;
  reliability_rating: number | null;
  training_quality_rating: number | null;
  review_title: string | null;
  review_body: string;
  reviewer_relationship: "parent_guardian" | "player" | "adult_player" | "former_player";
  player_age_band: "U8" | "U10" | "U12" | "U14" | "high_school" | "college" | "adult" | null;
  training_type: string | null;
  tags: string[];
  coach_reply: string | null;
  coach_reply_at: string | null;
  reported_at: string | null;
  report_reason: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type CoachReviewInvite = {
  id: string;
  coach_id: string;
  invited_email_normalized: string;
  invite_token: string;
  invited_by_user_id: string;
  invite_note: string | null;
  status: "sent" | "opened" | "completed" | "expired" | "revoked";
  expires_at: string | null;
  completed_by_user_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  pendingCount: number;
  publishedCount: number;
  verifiedCount: number;
  invitedCount: number;
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type CoachReliabilityBadge = {
  label: string;
  active: boolean;
  detail: string;
};

export type CoachReliability = {
  label: string;
  score: number | null;
  badges: CoachReliabilityBadge[];
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
  service_id?: string | null;
  service_title?: string | null;
  service_description?: string | null;
  selected_availability_block_id?: string | null;
  requested_date?: string | null;
  requested_start_time?: string | null;
  requested_end_time?: string | null;
  timezone?: string | null;
  player_age_at_request?: number | null;
  exact_location?: string | null;
  preferred_days_times: string | null;
  current_level: string | null;
  current_team?: string | null;
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
  | "request_accepted"
  | "request_declined"
  | "payment_required"
  | "payment_completed"
  | "future_session_requested"
  | "direct_payment_selected"
  | "direct_payment_received"
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
  availabilityBlocks?: CoachAvailabilityBlock[];
  reviews?: CoachReview[];
  reviewSummary?: CoachReviewSummary;
  reliability?: CoachReliability;
};

export type UserCoachingPreference = {
  user_id: string;
  player_name?: string | null;
  guardian_name?: string | null;
  player_age?: string | null;
  player_birth_date?: string | null;
  current_team?: string | null;
  contact_notes?: string | null;
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
