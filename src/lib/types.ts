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
  location: string | null;
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
  profile_status?: string | null;
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
  sort_order: number;
  created_at: string;
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
  is_saved: boolean;
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
};
