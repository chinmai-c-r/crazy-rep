-- Workouts imported from Google Health land in activity_logs. The Google Health id makes
-- re-imports idempotent; deleting an imported workout remembers it so it isn't imported again.

alter table public.activity_logs add column google_health_id text;
alter table public.activity_logs add constraint activity_logs_google_health_key unique (user_id, google_health_id);

create table public.google_health_dismissed (
  user_id          uuid not null references auth.users (id) on delete cascade,
  google_health_id text not null,
  primary key (user_id, google_health_id)
);
-- Server only, like the connection table
alter table public.google_health_dismissed enable row level security;
revoke all on public.google_health_dismissed from anon, authenticated;

create or replace function public.remember_dismissed_workout()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- When the whole account is being deleted the user row is already gone: nothing to remember
  if old.google_health_id is not null and exists (select 1 from auth.users where id = old.user_id) then
    insert into public.google_health_dismissed (user_id, google_health_id)
    values (old.user_id, old.google_health_id)
    on conflict do nothing;
  end if;
  return old;
end;
$$;
revoke all on function public.remember_dismissed_workout() from public, anon, authenticated;

create trigger activity_logs_remember_dismissed
  before delete on public.activity_logs
  for each row execute function public.remember_dismissed_workout();
