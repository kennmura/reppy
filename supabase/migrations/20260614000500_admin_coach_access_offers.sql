-- Admin-controlled coach premium offers. These are private allowlist records,
-- not public promo codes or Stripe coupons.

create extension if not exists "pgcrypto";

create table if not exists public.coach_access_offers (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  user_id uuid references auth.users(id) on delete set null,
  coach_id uuid references public.coaches(id) on delete set null,
  offer_type text not null,
  plan_code text not null,
  duration_type text not null,
  duration_months integer,
  starts_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone,
  is_lifetime boolean not null default false,
  max_redemptions integer not null default 1,
  redeemed_count integer not null default 0,
  redeemed_at timestamp with time zone,
  revoked_at timestamp with time zone,
  invite_token text unique,
  source text not null default 'admin',
  stripe_price_id text,
  stripe_subscription_schedule_id text,
  stripe_subscription_id text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  revoked_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint coach_access_offers_email_lower_check
    check (normalized_email = lower(btrim(normalized_email)) and normalized_email <> ''),
  constraint coach_access_offers_offer_type_check
    check (offer_type in ('free_premium', 'founding_599')),
  constraint coach_access_offers_plan_code_check
    check (
      (offer_type = 'free_premium' and plan_code = 'premium')
      or (offer_type = 'founding_599' and plan_code = 'founding_599')
    ),
  constraint coach_access_offers_duration_type_check
    check (duration_type in ('three_months', 'six_months', 'twelve_months', 'lifetime')),
  constraint coach_access_offers_duration_shape_check
    check (
      (
        duration_type = 'lifetime'
        and is_lifetime = true
        and duration_months is null
        and expires_at is null
      )
      or (
        duration_type <> 'lifetime'
        and is_lifetime = false
        and duration_months in (3, 6, 12)
        and expires_at is not null
        and expires_at > starts_at
      )
    ),
  constraint coach_access_offers_source_check
    check (source in ('admin', 'csv_upload', 'invite_link', 'referral', 'ambassador')),
  constraint coach_access_offers_redemption_check
    check (max_redemptions >= 1 and redeemed_count >= 0 and redeemed_count <= max_redemptions)
);

alter table public.coach_access_offers
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists revoked_by uuid references auth.users(id) on delete set null;

alter table public.subscriptions
  add column if not exists coach_id uuid references public.coaches(id) on delete set null,
  add column if not exists coach_access_offer_id uuid references public.coach_access_offers(id) on delete set null,
  add column if not exists stripe_price_id text,
  add column if not exists stripe_subscription_schedule_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists last_invoice_status text;

alter table public.premium_access_grants
  add column if not exists coach_access_offer_id uuid references public.coach_access_offers(id) on delete set null,
  add column if not exists updated_at timestamp with time zone not null default now();

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_coach_access_offers_updated_at on public.coach_access_offers;
create trigger set_coach_access_offers_updated_at
before update on public.coach_access_offers
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists set_premium_access_grants_updated_at on public.premium_access_grants;
create trigger set_premium_access_grants_updated_at
before update on public.premium_access_grants
for each row
execute function public.set_updated_at_timestamp();

create index if not exists coach_access_offers_email_idx
  on public.coach_access_offers(normalized_email);
create index if not exists coach_access_offers_invite_token_idx
  on public.coach_access_offers(invite_token)
  where invite_token is not null;
create index if not exists coach_access_offers_user_idx
  on public.coach_access_offers(user_id);
create index if not exists coach_access_offers_coach_idx
  on public.coach_access_offers(coach_id);
create index if not exists coach_access_offers_offer_type_idx
  on public.coach_access_offers(offer_type);
create index if not exists coach_access_offers_duration_type_idx
  on public.coach_access_offers(duration_type);
create index if not exists coach_access_offers_expires_at_idx
  on public.coach_access_offers(expires_at);
create index if not exists coach_access_offers_revoked_at_idx
  on public.coach_access_offers(revoked_at);
create index if not exists coach_access_offers_created_at_idx
  on public.coach_access_offers(created_at desc);
create index if not exists subscriptions_provider_subscription_idx
  on public.subscriptions(provider_subscription_id)
  where provider_subscription_id is not null;
create index if not exists subscriptions_coach_offer_idx
  on public.subscriptions(coach_access_offer_id)
  where coach_access_offer_id is not null;
create index if not exists premium_access_grants_coach_offer_idx
  on public.premium_access_grants(coach_access_offer_id)
  where coach_access_offer_id is not null;

alter table public.coach_access_offers enable row level security;

drop policy if exists "Admins can read coach access offers" on public.coach_access_offers;
create policy "Admins can read coach access offers"
on public.coach_access_offers for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Coaches can read claimed own access offers" on public.coach_access_offers;
create policy "Coaches can read claimed own access offers"
on public.coach_access_offers for select
to authenticated
using (user_id = auth.uid() or public.current_user_is_admin());

drop policy if exists "Admins can insert coach access offers" on public.coach_access_offers;
create policy "Admins can insert coach access offers"
on public.coach_access_offers for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update coach access offers" on public.coach_access_offers;
create policy "Admins can update coach access offers"
on public.coach_access_offers for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete coach access offers" on public.coach_access_offers;
create policy "Admins can delete coach access offers"
on public.coach_access_offers for delete
to authenticated
using (public.current_user_is_admin());
