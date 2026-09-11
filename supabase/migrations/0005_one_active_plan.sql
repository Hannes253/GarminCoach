-- Defense in depth: enforce "at most one active plan per user" at the DB
-- level too, not just in application code (lib/actions/plan.ts and
-- lib/adaptation/runLazyAdaptation.ts already order their writes to avoid
-- ever creating two, but a partial unique index makes it structurally
-- impossible regardless of future code paths).

create unique index training_plans_one_active_per_user
  on public.training_plans (user_id)
  where status = 'active';
