alter table public.coaches
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists zip_code text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

create index if not exists coaches_zip_code_idx on public.coaches(zip_code);
create index if not exists coaches_coordinates_idx on public.coaches(latitude, longitude)
  where latitude is not null and longitude is not null;
