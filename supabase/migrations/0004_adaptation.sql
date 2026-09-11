-- Phase 4 (Anpassungslogik): plan_adjustments, the mandatory audit trail the
-- adaptation engine writes to every time it reorders/reduces/regenerates a
-- plan. rationale_text is what the Plan page shows directly to the user.

create table public.plan_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.training_plans (id) on delete cascade,
  triggered_at timestamptz not null,
  trigger_type text not null check (
    trigger_type in ('missed_single_session', 'missed_consecutive_days', 'long_break', 'overtraining_ramp', 'manual')
  ),
  trigger_context jsonb not null default '{}'::jsonb,
  rule_applied text not null,
  rationale_text text not null,
  affected_week_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.plan_adjustments enable row level security;

create policy "select own plan_adjustments" on public.plan_adjustments
  for select using (auth.uid() = user_id);
create policy "insert own plan_adjustments" on public.plan_adjustments
  for insert with check (auth.uid() = user_id);
create policy "update own plan_adjustments" on public.plan_adjustments
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own plan_adjustments" on public.plan_adjustments
  for delete using (auth.uid() = user_id);

create index plan_adjustments_plan_id_idx on public.plan_adjustments (plan_id, triggered_at desc);
create index plan_adjustments_user_triggered_at_idx on public.plan_adjustments (user_id, triggered_at desc);
