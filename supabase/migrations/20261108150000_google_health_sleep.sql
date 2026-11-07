-- Sleep read from Google Health: one row per sleep session (a night's sleep or a nap).
-- Written only by the server; users can read and clear their own.

create table public.sleep_sessions (
  user_id          uuid not null references auth.users (id) on delete cascade,
  google_health_id text not null,
  day              date not null,                 -- the local day the session ended (the morning you woke up)
  started_at       timestamptz not null,
  ended_at         timestamptz not null,
  nap              boolean not null default false,
  in_bed_min       int not null check (in_bed_min between 0 and 2880),
  asleep_min       int not null check (asleep_min between 0 and 2880),
  awake_min        int not null default 0 check (awake_min between 0 and 2880),
  deep_min         int check (deep_min between 0 and 2880),
  light_min        int check (light_min between 0 and 2880),
  rem_min          int check (rem_min between 0 and 2880),
  synced_at        timestamptz not null default now(),
  primary key (user_id, google_health_id)
);
create index sleep_sessions_user_day_idx on public.sleep_sessions (user_id, day desc);

alter table public.sleep_sessions enable row level security;
create policy "sleep: read own" on public.sleep_sessions for select using ((select auth.uid()) = user_id);
create policy "sleep: delete own" on public.sleep_sessions for delete using ((select auth.uid()) = user_id);
revoke insert, update on public.sleep_sessions from anon, authenticated;
