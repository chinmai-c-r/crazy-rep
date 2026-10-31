-- Google Health sync: one OAuth connection per user, and the id of each meal's
-- entry in Google Health so edits and deletes can follow it.

create table public.google_health_connections (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now()
);

-- Refresh tokens never reach the browser: no policies and no grants means only
-- the server (secret key) can read or write this table.
alter table public.google_health_connections enable row level security;
revoke all on public.google_health_connections from anon, authenticated;

alter table public.meals add column google_health_id text;
