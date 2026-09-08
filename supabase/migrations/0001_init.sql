-- GarminCoach initial schema: Phase 0/1 scope (user_settings, activities,
-- activity_manual_fields, daily_log, import_batches, import_batch_items).
-- Planning/adaptation tables (training_plans, plan_phases, plan_weeks,
-- planned_workouts, plan_adjustments) are added in a later migration once
-- Phase 3/4 implementation starts, per the phased plan.

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- user_settings (1:1 with auth.users)
-- ---------------------------------------------------------------------

create table public.user_settings (
  id uuid primary key references auth.users (id) on delete cascade,
  race_date date,
  race_name text,
  current_plan_id uuid, -- FK to training_plans, added in the planning migration
  seed_pace_zones jsonb,
  seed_hr_zones jsonb,
  hr_max int,
  hr_rest int,
  threshold_pace_sec_per_km numeric,
  zone_methodology text,
  timezone text not null default 'Europe/Berlin',
  units text not null default 'metric',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "select own user_settings" on public.user_settings
  for select using (auth.uid() = id);
create policy "insert own user_settings" on public.user_settings
  for insert with check (auth.uid() = id);
create policy "update own user_settings" on public.user_settings
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "delete own user_settings" on public.user_settings
  for delete using (auth.uid() = id);

create trigger set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Auto-provision a user_settings row for the single account on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_settings (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- import_batches / import_batch_items (idempotency + import audit trail)
-- ---------------------------------------------------------------------

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_type text not null check (source_type in ('fit_zip', 'csv')),
  file_name text not null,
  file_hash text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  activity_count int not null default 0,
  error_log jsonb,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

alter table public.import_batches enable row level security;

create policy "select own import_batches" on public.import_batches
  for select using (auth.uid() = user_id);
create policy "insert own import_batches" on public.import_batches
  for insert with check (auth.uid() = user_id);
create policy "update own import_batches" on public.import_batches
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own import_batches" on public.import_batches
  for delete using (auth.uid() = user_id);

create index import_batches_user_id_idx on public.import_batches (user_id, created_at desc);

create table public.import_batch_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  import_batch_id uuid not null references public.import_batches (id) on delete cascade,
  item_name text not null,
  file_hash text,
  dedup_key text,
  status text not null check (status in ('imported', 'duplicate_skipped', 'enriched_existing', 'error')),
  activity_id uuid, -- FK to activities added below (created after activities exists)
  error text,
  created_at timestamptz not null default now()
);

alter table public.import_batch_items enable row level security;

create policy "select own import_batch_items" on public.import_batch_items
  for select using (auth.uid() = user_id);
create policy "insert own import_batch_items" on public.import_batch_items
  for insert with check (auth.uid() = user_id);
create policy "update own import_batch_items" on public.import_batch_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own import_batch_items" on public.import_batch_items
  for delete using (auth.uid() = user_id);

create index import_batch_items_batch_id_idx on public.import_batch_items (import_batch_id);

-- ---------------------------------------------------------------------
-- activities (unified load ledger: run/bike/strength/other)
-- ---------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('fit', 'csv', 'manual')),
  sport text not null check (sport in ('run', 'bike', 'strength', 'other')),
  sub_sport text,
  dedup_key text not null,
  file_hash text,
  start_time timestamptz not null,
  duration_seconds numeric not null,
  distance_meters numeric,
  avg_pace_sec_per_km numeric,
  avg_hr int,
  max_hr int,
  hr_zone_seconds jsonb,
  elevation_gain_meters numeric,
  avg_cadence numeric,
  calories int,
  source_import_batch_id uuid references public.import_batches (id) on delete set null,
  source_item_id uuid references public.import_batch_items (id) on delete set null,
  raw_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

alter table public.activities enable row level security;

create policy "select own activities" on public.activities
  for select using (auth.uid() = user_id);
create policy "insert own activities" on public.activities
  for insert with check (auth.uid() = user_id);
create policy "update own activities" on public.activities
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own activities" on public.activities
  for delete using (auth.uid() = user_id);

create index activities_user_start_time_idx on public.activities (user_id, start_time desc);
create index activities_user_sport_idx on public.activities (user_id, sport);

create trigger set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

alter table public.import_batch_items
  add constraint import_batch_items_activity_id_fkey
  foreign key (activity_id) references public.activities (id) on delete set null;

-- ---------------------------------------------------------------------
-- activity_manual_fields (RPE + note, per activity)
-- ---------------------------------------------------------------------

create table public.activity_manual_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_id uuid not null unique references public.activities (id) on delete cascade,
  rpe smallint check (rpe between 1 and 10),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.activity_manual_fields enable row level security;

create policy "select own activity_manual_fields" on public.activity_manual_fields
  for select using (auth.uid() = user_id);
create policy "insert own activity_manual_fields" on public.activity_manual_fields
  for insert with check (auth.uid() = user_id);
create policy "update own activity_manual_fields" on public.activity_manual_fields
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own activity_manual_fields" on public.activity_manual_fields
  for delete using (auth.uid() = user_id);

create trigger set_updated_at
  before update on public.activity_manual_fields
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- daily_log (sleep + free-text note, per calendar day)
-- ---------------------------------------------------------------------

create table public.daily_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  sleep_hours numeric,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  note text,
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table public.daily_log enable row level security;

create policy "select own daily_log" on public.daily_log
  for select using (auth.uid() = user_id);
create policy "insert own daily_log" on public.daily_log
  for insert with check (auth.uid() = user_id);
create policy "update own daily_log" on public.daily_log
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own daily_log" on public.daily_log
  for delete using (auth.uid() = user_id);

create trigger set_updated_at
  before update on public.daily_log
  for each row execute function public.set_updated_at();
