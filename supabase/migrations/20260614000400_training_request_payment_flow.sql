-- Application support for coach-owned request decisions, first-session
-- platform payments, and future-session direct/platform payment choices.

create extension if not exists "pgcrypto";

alter table public.coaches
  add column if not exists coach_direct_preferred boolean not null default true,
  add column if not exists platform_payment_allowed boolean not null default true,
  add column if not exists platform_payment_required boolean not null default false,
  add column if not exists stripe_connected_account_id text;

alter table public.training_requests
  drop constraint if exists training_requests_status_check;

update public.training_requests
set status = case
  when status in ('pending', 'accepted_pending_payment', 'paid_confirmed', 'declined', 'cancelled', 'completed', 'refunded') then status
  when status in ('new', 'contacted') then 'pending'
  when status in ('accepted', 'scheduled') then 'accepted_pending_payment'
  when status = 'closed' then 'completed'
  else 'pending'
end;

alter table public.training_requests
  add column if not exists payment_status text not null default 'not_required',
  add column if not exists payment_method text,
  add column if not exists gross_amount_cents integer,
  add column if not exists platform_fee_cents integer,
  add column if not exists coach_payout_cents integer,
  add column if not exists currency text not null default 'usd',
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists accepted_at timestamp with time zone,
  add column if not exists declined_at timestamp with time zone,
  add column if not exists paid_confirmed_at timestamp with time zone,
  add column if not exists refunded_at timestamp with time zone;

update public.training_requests
set
  payment_status = case
    when status = 'accepted_pending_payment' then 'requires_payment'
    when status in ('paid_confirmed', 'completed') then 'paid'
    when status in ('declined', 'cancelled') then 'not_required'
    when status = 'refunded' then 'refunded'
    else coalesce(nullif(payment_status, ''), 'not_required')
  end,
  payment_method = case
    when status in ('accepted_pending_payment', 'paid_confirmed', 'refunded') then coalesce(payment_method, 'platform')
    else payment_method
  end
where payment_status is null
  or payment_status not in (
    'not_required',
    'requires_payment',
    'checkout_created',
    'paid',
    'coach_direct_pending',
    'coach_marked_paid',
    'failed',
    'expired',
    'refunded'
  );

alter table public.training_requests
  alter column status set default 'pending',
  alter column status set not null,
  alter column payment_status set default 'not_required',
  alter column payment_status set not null,
  alter column currency set default 'usd',
  alter column currency set not null;

alter table public.training_requests
  add constraint training_requests_status_check
    check (status in ('pending', 'accepted_pending_payment', 'paid_confirmed', 'declined', 'cancelled', 'completed', 'refunded')) not valid;

alter table public.training_requests validate constraint training_requests_status_check;

alter table public.training_requests
  drop constraint if exists training_requests_payment_status_check,
  add constraint training_requests_payment_status_check
    check (payment_status in ('not_required', 'requires_payment', 'checkout_created', 'paid', 'coach_direct_pending', 'coach_marked_paid', 'failed', 'expired', 'refunded')) not valid,
  drop constraint if exists training_requests_payment_method_check,
  add constraint training_requests_payment_method_check
    check (payment_method is null or payment_method in ('platform', 'coach_direct')) not valid,
  drop constraint if exists training_requests_amounts_check,
  add constraint training_requests_amounts_check
    check (
      (gross_amount_cents is null or gross_amount_cents >= 0)
      and (platform_fee_cents is null or platform_fee_cents >= 0)
      and (coach_payout_cents is null or coach_payout_cents >= 0)
    ) not valid;

alter table public.training_requests validate constraint training_requests_payment_status_check;
alter table public.training_requests validate constraint training_requests_payment_method_check;
alter table public.training_requests validate constraint training_requests_amounts_check;

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  training_request_id uuid references public.training_requests(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null,
  coach_user_id uuid references auth.users(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  service_id uuid references public.coach_services(id) on delete set null,
  service_title text,
  session_kind text not null default 'future_session',
  status text not null default 'requested',
  payment_status text not null default 'not_required',
  payment_method text,
  requested_date date,
  requested_start_time time,
  requested_end_time time,
  timezone text default 'America/New_York',
  preferred_days_times text,
  location text,
  notes text,
  gross_amount_cents integer,
  platform_fee_cents integer,
  coach_payout_cents integer,
  currency text not null default 'usd',
  paid_at timestamp with time zone,
  completed_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint training_sessions_session_kind_check check (session_kind in ('first_session', 'future_session')),
  constraint training_sessions_status_check check (status in ('requested', 'accepted_pending_payment', 'paid_confirmed', 'direct_payment_pending', 'confirmed', 'declined', 'cancelled', 'completed', 'refunded')),
  constraint training_sessions_payment_status_check check (payment_status in ('not_required', 'requires_payment', 'checkout_created', 'paid', 'coach_direct_pending', 'coach_marked_paid', 'failed', 'expired', 'refunded')),
  constraint training_sessions_payment_method_check check (payment_method is null or payment_method in ('platform', 'coach_direct')),
  constraint training_sessions_requested_time_check check (
    requested_start_time is null
    or requested_end_time is null
    or requested_end_time > requested_start_time
  ),
  constraint training_sessions_amounts_check check (
    (gross_amount_cents is null or gross_amount_cents >= 0)
    and (platform_fee_cents is null or platform_fee_cents >= 0)
    and (coach_payout_cents is null or coach_payout_cents >= 0)
  )
);

create unique index if not exists training_sessions_first_request_idx
  on public.training_sessions(training_request_id)
  where session_kind = 'first_session';

create index if not exists training_sessions_coach_date_idx
  on public.training_sessions(coach_id, requested_date, requested_start_time);
create index if not exists training_sessions_requester_created_idx
  on public.training_sessions(requester_user_id, created_at desc);
create index if not exists training_sessions_conversation_idx
  on public.training_sessions(conversation_id, created_at desc);

create table if not exists public.training_request_payments (
  id uuid primary key default gen_random_uuid(),
  training_request_id uuid references public.training_requests(id) on delete cascade,
  training_session_id uuid references public.training_sessions(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null,
  coach_user_id uuid references auth.users(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  service_id uuid references public.coach_services(id) on delete set null,
  service_title text,
  session_kind text not null default 'first_session',
  payment_method text not null default 'platform',
  status text not null default 'requires_payment',
  gross_amount_cents integer not null,
  platform_fee_cents integer not null default 0,
  coach_payout_cents integer not null,
  currency text not null default 'usd',
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_payment_status text,
  checkout_url text,
  requested_date date,
  requested_start_time time,
  requested_end_time time,
  timezone text default 'America/New_York',
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamp with time zone,
  failed_at timestamp with time zone,
  expired_at timestamp with time zone,
  refunded_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint training_request_payments_session_kind_check check (session_kind in ('first_session', 'future_session')),
  constraint training_request_payments_method_check check (payment_method in ('platform', 'coach_direct')),
  constraint training_request_payments_status_check check (status in ('requires_payment', 'checkout_created', 'paid', 'coach_direct_pending', 'coach_marked_paid', 'failed', 'expired', 'refunded')),
  constraint training_request_payments_amounts_check check (
    gross_amount_cents >= 0
    and platform_fee_cents >= 0
    and coach_payout_cents >= 0
  )
);

create unique index if not exists training_request_payments_first_request_idx
  on public.training_request_payments(training_request_id)
  where session_kind = 'first_session';
create index if not exists training_request_payments_requester_created_idx
  on public.training_request_payments(requester_user_id, created_at desc);
create index if not exists training_request_payments_coach_created_idx
  on public.training_request_payments(coach_id, created_at desc);
create index if not exists training_request_payments_session_idx
  on public.training_request_payments(training_session_id);

drop index if exists public.training_requests_active_requester_coach_idx;
create index training_requests_active_requester_coach_idx
  on public.training_requests(requester_user_id, coach_id, status)
  where status in ('pending', 'accepted_pending_payment', 'paid_confirmed');

create index if not exists training_requests_payment_status_idx
  on public.training_requests(payment_status, status);

alter table public.training_sessions enable row level security;
alter table public.training_request_payments enable row level security;

drop policy if exists "Coaches can update requests sent to them" on public.training_requests;
create policy "Coaches can update requests sent to them"
on public.training_requests for update
to authenticated
using (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.coaches
    where coaches.id = training_requests.coach_id
      and coaches.user_id = auth.uid()
  )
)
with check (
  public.current_user_is_admin()
  or exists (
    select 1
    from public.coaches
    where coaches.id = training_requests.coach_id
      and coaches.user_id = auth.uid()
  )
);

drop policy if exists "Users can read own training sessions" on public.training_sessions;
create policy "Users can read own training sessions"
on public.training_sessions for select
to authenticated
using (
  requester_user_id = auth.uid()
  or coach_user_id = auth.uid()
  or public.current_user_is_admin()
);

drop policy if exists "Users can create own future training sessions" on public.training_sessions;
create policy "Users can create own future training sessions"
on public.training_sessions for insert
to authenticated
with check (
  requester_user_id = auth.uid()
  and session_kind = 'future_session'
);

drop policy if exists "Coaches can update own training sessions" on public.training_sessions;
create policy "Coaches can update own training sessions"
on public.training_sessions for update
to authenticated
using (coach_user_id = auth.uid() or public.current_user_is_admin())
with check (coach_user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Users can read own training payments" on public.training_request_payments;
create policy "Users can read own training payments"
on public.training_request_payments for select
to authenticated
using (
  requester_user_id = auth.uid()
  or coach_user_id = auth.uid()
  or public.current_user_is_admin()
);

drop policy if exists "Coaches can update direct training payments" on public.training_request_payments;
create policy "Coaches can update direct training payments"
on public.training_request_payments for update
to authenticated
using (
  payment_method = 'coach_direct'
  and (coach_user_id = auth.uid() or public.current_user_is_admin())
)
with check (
  payment_method = 'coach_direct'
  and (coach_user_id = auth.uid() or public.current_user_is_admin())
);
