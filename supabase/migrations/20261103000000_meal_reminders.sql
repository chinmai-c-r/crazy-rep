-- ─────────────────────────────────────────────────────────────
-- Meal reminders: push subscriptions, per-user reminder times, and a pg_cron job that
-- asks the app to send the notifications that are due.
-- ─────────────────────────────────────────────────────────────

-- One row per device that agreed to notifications. Written by the server (it also takes over an
-- endpoint when someone signs in on a shared device), so users only need to read and remove their own.
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
create policy "push subscriptions: read own"   on public.push_subscriptions for select using ((select auth.uid()) = user_id);
create policy "push subscriptions: delete own" on public.push_subscriptions for delete using ((select auth.uid()) = user_id);

-- One row per user. A null time means that meal has no reminder.
create table public.reminder_settings (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled      boolean not null default true,
  timezone     text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  breakfast_at time default '08:30',
  lunch_at     time default '13:30',
  dinner_at    time default '20:00',
  -- The local date each meal's reminder last went out, e.g. {"lunch": "2026-11-03"}, so nobody gets it twice a day.
  last_sent    jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.reminder_settings enable row level security;
create policy "reminders: read own"   on public.reminder_settings for select using ((select auth.uid()) = user_id);
create policy "reminders: insert own" on public.reminder_settings for insert with check ((select auth.uid()) = user_id);
create policy "reminders: update own" on public.reminder_settings for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reminders: delete own" on public.reminder_settings for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Scheduler: every 15 minutes pg_cron calls the app, which works out who is due in their own timezone.
-- The app's address and a shared secret live in Vault (see README → Meal reminders), never in this file.
-- Until both exist the job does nothing.
-- ─────────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.ping_meal_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text;
  secret text;
begin
  select decrypted_secret into target from vault.decrypted_secrets where name = 'reminders_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'reminders_secret';
  if target is null or secret is null then
    return;
  end if;

  perform net.http_post(
    url := target,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

-- Only the database itself (pg_cron) may run it
revoke all on function public.ping_meal_reminders() from public, anon, authenticated;

-- Replace the job if it already exists so this file can be re-applied
do $$
begin
  perform cron.unschedule('meal-reminders') where exists (select 1 from cron.job where jobname = 'meal-reminders');
end $$;

select cron.schedule('meal-reminders', '*/15 * * * *', $$select public.ping_meal_reminders()$$);
