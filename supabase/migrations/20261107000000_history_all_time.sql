-- ─────────────────────────────────────────────────────────────
-- History "All" range: lift the limit on history_summary from about 6 years to 100.
-- The function still returns one row per day, week or month in the range, so the app asks for the months
-- between someone's first logged day and today. Nothing else about it changes (grants stay as they were).
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
  if p_end < p_start or p_end - p_start > 36600 then
    raise exception 'range must be between 1 day and 100 years';
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
