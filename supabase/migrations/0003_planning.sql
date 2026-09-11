-- Phase 3 (Planung): training_plans, plan_phases, plan_weeks, planned_workouts.
-- plan_adjustments (the adaptation-log table) is added in the Phase 4 migration,
-- once the adaptation engine exists to write to it.

-- ---------------------------------------------------------------------
-- training_plans
-- ---------------------------------------------------------------------

create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  race_date date not null,
  status text not null default 'active' check (status in ('active', 'superseded', 'draft')),
  generation_reason text not null check (generation_reason in ('initial', 'regression_after_break', 'manual_regenerate')),
  superseded_by_plan_id uuid references public.training_plans (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.training_plans enable row level security;

create policy "select own training_plans" on public.training_plans
  for select using (auth.uid() = user_id);
create policy "insert own training_plans" on public.training_plans
  for insert with check (auth.uid() = user_id);
create policy "update own training_plans" on public.training_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own training_plans" on public.training_plans
  for delete using (auth.uid() = user_id);

create index training_plans_user_status_idx on public.training_plans (user_id, status);

create trigger set_updated_at
  before update on public.training_plans
  for each row execute function public.set_updated_at();

alter table public.user_settings
  add constraint user_settings_current_plan_id_fkey
  foreign key (current_plan_id) references public.training_plans (id) on delete set null;

-- ---------------------------------------------------------------------
-- plan_phases
-- ---------------------------------------------------------------------

create table public.plan_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  phase_type text not null check (phase_type in ('base', 'build', 'specific', 'taper')),
  start_date date not null,
  end_date date not null,
  sequence_order int not null,
  target_weekly_volume_km numeric,
  created_at timestamptz not null default now()
);

alter table public.plan_phases enable row level security;

create policy "select own plan_phases" on public.plan_phases
  for select using (auth.uid() = user_id);
create policy "insert own plan_phases" on public.plan_phases
  for insert with check (auth.uid() = user_id);
create policy "update own plan_phases" on public.plan_phases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own plan_phases" on public.plan_phases
  for delete using (auth.uid() = user_id);

create index plan_phases_plan_id_idx on public.plan_phases (plan_id, sequence_order);

-- ---------------------------------------------------------------------
-- plan_weeks
-- ---------------------------------------------------------------------

create table public.plan_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phase_id uuid not null references public.plan_phases (id) on delete cascade,
  week_start_date date not null,
  week_number int not null,
  is_deload boolean not null default false,
  target_volume_km numeric not null,
  target_long_run_km numeric,
  status text not null default 'planned' check (status in ('planned', 'active', 'completed')),
  created_at timestamptz not null default now()
);

alter table public.plan_weeks enable row level security;

create policy "select own plan_weeks" on public.plan_weeks
  for select using (auth.uid() = user_id);
create policy "insert own plan_weeks" on public.plan_weeks
  for insert with check (auth.uid() = user_id);
create policy "update own plan_weeks" on public.plan_weeks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own plan_weeks" on public.plan_weeks
  for delete using (auth.uid() = user_id);

create index plan_weeks_phase_id_idx on public.plan_weeks (phase_id, week_number);
create index plan_weeks_user_start_date_idx on public.plan_weeks (user_id, week_start_date);

-- ---------------------------------------------------------------------
-- planned_workouts
-- ---------------------------------------------------------------------

create table public.planned_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_week_id uuid not null references public.plan_weeks (id) on delete cascade,
  date date not null,
  sequence_in_week int not null,
  workout_type text not null check (workout_type in ('easy', 'long_run', 'tempo', 'intervals', 'recovery', 'rest')),
  target_distance_km numeric,
  target_duration_minutes numeric,
  target_pace_range jsonb,
  target_hr_zone text check (target_hr_zone in ('z1', 'z2', 'z3', 'z4', 'z5')),
  status text not null default 'planned' check (status in ('planned', 'completed', 'missed', 'skipped_replanned', 'modified')),
  completed_activity_id uuid references public.activities (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planned_workouts enable row level security;

create policy "select own planned_workouts" on public.planned_workouts
  for select using (auth.uid() = user_id);
create policy "insert own planned_workouts" on public.planned_workouts
  for insert with check (auth.uid() = user_id);
create policy "update own planned_workouts" on public.planned_workouts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own planned_workouts" on public.planned_workouts
  for delete using (auth.uid() = user_id);

create index planned_workouts_week_id_idx on public.planned_workouts (plan_week_id, sequence_in_week);
create index planned_workouts_user_date_idx on public.planned_workouts (user_id, date);

create trigger set_updated_at
  before update on public.planned_workouts
  for each row execute function public.set_updated_at();
