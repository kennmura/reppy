alter table public.account_private_details
  add column if not exists player_date_of_birth date;

alter table public.coaches
  add column if not exists timezone text default 'America/New_York';

alter table public.coach_availability_blocks
  add column if not exists timezone text not null default 'America/New_York';

alter table public.training_requests
  add column if not exists player_age_at_request integer,
  add column if not exists selected_availability_block_id uuid references public.coach_availability_blocks(id) on delete set null,
  add column if not exists requested_date date,
  add column if not exists requested_start_time time,
  add column if not exists requested_end_time time,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists updated_at timestamp with time zone default now();

update public.training_requests
set status = 'pending'
where status = 'new';

alter table public.conversation_private_details
  add column if not exists selected_availability_block_id uuid references public.coach_availability_blocks(id) on delete set null,
  add column if not exists requested_date date,
  add column if not exists requested_start_time time,
  add column if not exists requested_end_time time,
  add column if not exists timezone text default 'America/New_York',
  add column if not exists player_age_at_request integer,
  add column if not exists current_team text;

create index if not exists training_requests_coach_requested_date_idx
  on public.training_requests(coach_id, requested_date, requested_start_time)
  where requested_date is not null;

create index if not exists training_requests_status_idx
  on public.training_requests(status);

create index if not exists account_private_details_player_dob_idx
  on public.account_private_details(player_date_of_birth)
  where player_date_of_birth is not null;
