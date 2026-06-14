-- Reppy Supabase bootstrap order for a new project.
-- Run these files in this exact order from the Supabase SQL Editor:
--
-- 1. supabase/schema.sql
-- 2. supabase/migrations/20260613_internal_messaging_push_retention.sql
-- 3. supabase/seed.sql
--
-- This file is intentionally non-destructive. It verifies that required
-- extensions and tables are present after the files above have run.

create extension if not exists "pgcrypto";

do $$
begin
  if to_regclass('public.conversations') is null then
    raise exception 'Run supabase/schema.sql before this bootstrap check.';
  end if;

  if to_regclass('public.conversation_participants') is null then
    raise exception 'Run the internal messaging migration before this bootstrap check.';
  end if;

  if to_regclass('public.push_subscriptions') is null then
    raise exception 'Push subscription table is missing.';
  end if;
end $$;
