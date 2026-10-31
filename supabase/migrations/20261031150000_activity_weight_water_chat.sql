-- Activity, weight and water logging, chat history, the USDA meal source,
-- and a server-side summary function for long (up to 5-year) history ranges.

-- ─────────────────────────────────────────────────────────────
-- Meals can now come from USDA FoodData Central
-- ─────────────────────────────────────────────────────────────
alter table public.meals drop constraint if exists meals_source_check;
alter table public.meals
  add constraint meals_source_check check (source in ('photo', 'text', 'cache', 'usda'));

alter table public.profiles
  add column water_goal_ml int not null default 2500 check (water_goal_ml between 500 and 10000);

-- ─────────────────────────────────────────────────────────────
-- Activity logs
-- ─────────────────────────────────────────────────────────────
create table public.activity_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  performed_at    timestamptz not null default now(),
  activity        text not null check (char_length(activity) between 1 and 60),
  intensity       text not null default 'moderate' check (intensity in ('light', 'moderate', 'vigorous')),
  duration_min    int not null check (duration_min between 1 and 1440),
  calories_burned numeric(7,1) not null check (calories_burned between 0 and 20000),
  distance_km     numeric(6,2) check (distance_km between 0 and 1000),
  steps           int check (steps between 0 and 200000),
  notes           text check (char_length(notes) <= 300),
  created_at      timestamptz not null default now()
);
create index activity_logs_user_time_idx on public.activity_logs (user_id, performed_at desc);

-- ─────────────────────────────────────────────────────────────
-- Weight logs: one entry per local day (re-logging the same day updates it)
-- ─────────────────────────────────────────────────────────────
create table public.weight_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_on    date not null,
  weight_kg    numeric(5,1) not null check (weight_kg between 25 and 400),
  body_fat_pct numeric(4,1) check (body_fat_pct between 2 and 75),
  notes        text check (char_length(notes) <= 300),
  created_at   timestamptz not null default now(),
  unique (user_id, logged_on)
);

-- ─────────────────────────────────────────────────────────────
-- Water logs
-- ─────────────────────────────────────────────────────────────
create table public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_at  timestamptz not null default now(),
  ml         int not null check (ml between 1 and 5000)
);
create index water_logs_user_time_idx on public.water_logs (user_id, logged_at desc);

-- ─────────────────────────────────────────────────────────────
-- Coach chat history
-- ─────────────────────────────────────────────────────────────
create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);
create index chat_messages_user_time_idx on public.chat_messages (user_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row level security: own rows only
-- ─────────────────────────────────────────────────────────────
alter table public.activity_logs enable row level security;
alter table public.weight_logs   enable row level security;
alter table public.water_logs    enable row level security;
alter table public.chat_messages enable row level security;

create policy "activity: own" on public.activity_logs for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "weight: own" on public.weight_logs for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "water: own" on public.water_logs for all
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Chat rows are written by the server on the user's behalf; users may read and clear them.
create policy "chat: read own" on public.chat_messages for select using ((select auth.uid()) = user_id);
create policy "chat: insert own" on public.chat_messages for insert with check ((select auth.uid()) = user_id);
create policy "chat: delete own" on public.chat_messages for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Keep profiles.weight_kg equal to the most recent weight log
-- ─────────────────────────────────────────────────────────────
create or replace function public.sync_profile_weight()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  uid uuid := coalesce(new.user_id, old.user_id);
begin
  update public.profiles p
     set weight_kg = (
       select w.weight_kg from public.weight_logs w
        where w.user_id = uid
        order by w.logged_on desc
        limit 1
     )
   where p.id = uid
     and exists (select 1 from public.weight_logs w where w.user_id = uid);
  return null;
end;
$$;

create trigger weight_logs_sync_profile
  after insert or update or delete on public.weight_logs
  for each row execute function public.sync_profile_weight();

-- ─────────────────────────────────────────────────────────────
-- History summary: per day / week / month in the user's timezone.
-- Runs as the caller (security invoker), so RLS limits it to their rows.
-- ─────────────────────────────────────────────────────────────
create or replace function public.history_summary(
  p_start  date,
  p_end    date,
  p_bucket text default 'day',
  p_tz     text default 'UTC'
)
returns table (
  bucket          date,
  days_logged     int,
  meals           int,
  calories        numeric,
  protein_g       numeric,
  carbs_g         numeric,
  fat_g           numeric,
  fiber_g         numeric,
  sugar_g         numeric,
  sodium_mg       numeric,
  burned_kcal     numeric,
  active_min      int,
  water_ml        int,
  avg_weight_kg   numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'p_bucket must be day, week or month';
  end if;
  if p_end < p_start or p_end - p_start > 2200 then
    raise exception 'range must be between 1 day and 6 years';
  end if;
  perform now() at time zone p_tz; -- raises on an invalid timezone name

  return query
  with b as (
    select gs::date as bucket
      from generate_series(date_trunc(p_bucket, p_start::timestamp), p_end::timestamp, ('1 ' || p_bucket)::interval) gs
  ),
  m as (
    select date_trunc(p_bucket, (x.eaten_at at time zone p_tz))::date as bucket,
           count(*)::int as meals,
           count(distinct (x.eaten_at at time zone p_tz)::date)::int as days,
           sum(x.calories) as calories, sum(x.protein_g) as protein_g, sum(x.carbs_g) as carbs_g,
           sum(x.fat_g) as fat_g, sum(x.fiber_g) as fiber_g, sum(x.sugar_g) as sugar_g, sum(x.sodium_mg) as sodium_mg
      from public.meals x
     where x.user_id = (select auth.uid())
       and x.eaten_at >= (p_start::timestamp at time zone p_tz)
       and x.eaten_at <  ((p_end + 1)::timestamp at time zone p_tz)
     group by 1
  ),
  a as (
    select date_trunc(p_bucket, (y.performed_at at time zone p_tz))::date as bucket,
           sum(y.calories_burned) as burned, sum(y.duration_min)::int as minutes
      from public.activity_logs y
     where y.user_id = (select auth.uid())
       and y.performed_at >= (p_start::timestamp at time zone p_tz)
       and y.performed_at <  ((p_end + 1)::timestamp at time zone p_tz)
     group by 1
  ),
  h as (
    select date_trunc(p_bucket, (v.logged_at at time zone p_tz))::date as bucket, sum(v.ml)::int as ml
      from public.water_logs v
     where v.user_id = (select auth.uid())
       and v.logged_at >= (p_start::timestamp at time zone p_tz)
       and v.logged_at <  ((p_end + 1)::timestamp at time zone p_tz)
     group by 1
  ),
  w as (
    select date_trunc(p_bucket, z.logged_on::timestamp)::date as bucket, round(avg(z.weight_kg), 1) as weight
      from public.weight_logs z
     where z.user_id = (select auth.uid())
       and z.logged_on between p_start and p_end
     group by 1
  )
  select b.bucket,
         coalesce(m.days, 0), coalesce(m.meals, 0),
         coalesce(m.calories, 0), coalesce(m.protein_g, 0), coalesce(m.carbs_g, 0), coalesce(m.fat_g, 0),
         coalesce(m.fiber_g, 0), coalesce(m.sugar_g, 0), coalesce(m.sodium_mg, 0),
         coalesce(a.burned, 0), coalesce(a.minutes, 0), coalesce(h.ml, 0),
         w.weight
    from b
    left join m on m.bucket = b.bucket
    left join a on a.bucket = b.bucket
    left join h on h.bucket = b.bucket
    left join w on w.bucket = b.bucket
   order by b.bucket;
end;
$$;

revoke all on function public.history_summary(date, date, text, text) from public, anon;
grant execute on function public.history_summary(date, date, text, text) to authenticated;
