alter table public.user_coaching_preferences
  add column if not exists player_name text,
  add column if not exists guardian_name text,
  add column if not exists player_age text,
  add column if not exists player_birth_date date,
  add column if not exists current_team text,
  add column if not exists contact_notes text;

alter table public.training_requests
  add column if not exists service_id uuid references public.coach_services(id) on delete set null,
  add column if not exists service_title text,
  add column if not exists service_description text;

alter table public.conversation_private_details
  add column if not exists service_id uuid references public.coach_services(id) on delete set null,
  add column if not exists service_title text,
  add column if not exists service_description text;

create index if not exists training_requests_service_idx
  on public.training_requests(service_id);
