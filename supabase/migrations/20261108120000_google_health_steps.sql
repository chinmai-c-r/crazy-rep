-- Google Health activity import: which permissions each connection was granted,
-- and the daily step totals read from Google Health.

alter table public.google_health_connections add column scopes text not null default '';

-- Connections made before this migration only had the nutrition permission
update public.google_health_connections
set scopes = 'https://www.googleapis.com/auth/googlehealth.nutrition.writeonly'
where scopes = '';

-- One row per local day. Written only by the server (after reading Google Health); users can read and clear their own.
create table public.step_days (
  user_id   uuid not null references auth.users (id) on delete cascade,
  day       date not null,
  steps     int  not null check (steps between 0 and 1000000),
  synced_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.step_days enable row level security;
create policy "steps: read own" on public.step_days for select using ((select auth.uid()) = user_id);
create policy "steps: delete own" on public.step_days for delete using ((select auth.uid()) = user_id);
revoke insert, update on public.step_days from anon, authenticated;
