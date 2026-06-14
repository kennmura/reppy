create table if not exists coach_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references coaches(id) on delete cascade,
  coach_user_id uuid references auth.users(id) on delete cascade,
  availability_date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/New_York',
  note text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint coach_availability_blocks_time_check check (end_time > start_time)
);

create index if not exists coach_availability_blocks_coach_date_idx
on coach_availability_blocks(coach_id, availability_date, start_time);

create index if not exists coach_availability_blocks_user_date_idx
on coach_availability_blocks(coach_user_id, availability_date);

alter table coach_availability_blocks enable row level security;

drop policy if exists "Published coach availability is public" on coach_availability_blocks;
create policy "Published coach availability is public"
on coach_availability_blocks for select
using (
  exists (
    select 1
    from coaches
    where coaches.id = coach_availability_blocks.coach_id
      and coaches.is_published = true
  )
);

drop policy if exists "Coaches manage own availability" on coach_availability_blocks;
create policy "Coaches manage own availability"
on coach_availability_blocks for all
using (
  auth.uid() = coach_user_id
  or exists (
    select 1
    from coaches
    where coaches.id = coach_availability_blocks.coach_id
      and coaches.user_id = auth.uid()
  )
)
with check (
  auth.uid() = coach_user_id
  or exists (
    select 1
    from coaches
    where coaches.id = coach_availability_blocks.coach_id
      and coaches.user_id = auth.uid()
  )
);
