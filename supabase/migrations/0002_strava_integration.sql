-- Strava auto-sync: OAuth token storage + a new "strava" activity source.
--
-- Garmin -> Strava forwarding (set up on the user's side in Garmin Connect)
-- plus Strava's push-subscription webhooks give us near-real-time activity
-- delivery without ever touching Garmin credentials, official or otherwise.
-- See lib/strava/client.ts and app/api/strava/{connect,callback,webhook}
-- for the flow this table supports.

alter table public.activities
  drop constraint activities_source_check;
alter table public.activities
  add constraint activities_source_check check (source in ('fit', 'csv', 'manual', 'strava'));

create table public.strava_connection (
  user_id uuid primary key references auth.users (id) on delete cascade,
  athlete_id bigint not null unique,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.strava_connection enable row level security;

-- Normal user-session policies, for the connect/callback flow (a real user
-- is present with a valid session there). The webhook handler is the one
-- caller that must bypass these - see lib/supabase/service.ts for why.
create policy "select own strava_connection" on public.strava_connection
  for select using (auth.uid() = user_id);
create policy "insert own strava_connection" on public.strava_connection
  for insert with check (auth.uid() = user_id);
create policy "update own strava_connection" on public.strava_connection
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own strava_connection" on public.strava_connection
  for delete using (auth.uid() = user_id);

create trigger set_updated_at
  before update on public.strava_connection
  for each row execute function public.set_updated_at();
