-- ─────────────────────────────────────────────────────────────
-- Meal search: make the items inside meals (the detected sub-items) searchable too.
--   • meal_dishes() now also returns `items`: what was found inside each dish's meals, most common first
--   • meal_dish_history() now also returns each meal's `items`
-- Both return a new column, so they are dropped and created again (create or replace can't change what a function returns).
-- ─────────────────────────────────────────────────────────────
drop function if exists public.meal_dishes();
drop function if exists public.meal_dish_history(text, int);

-- One row per dish the signed-in person has logged, most recently eaten first. `items` lists what was found inside that
-- dish's meals (the detected sub-items: the chutney in a dosa meal), most common first, so they can be searched too.
create or replace function public.meal_dishes()
returns table (
  name_key    text,
  name        text,
  times       int,
  first_at    timestamptz,
  last_at     timestamptz,
  avg_kcal    numeric,
  avg_protein numeric,
  avg_carbs   numeric,
  avg_fat     numeric,
  breakfast   int,
  lunch       int,
  dinner      int,
  snack       int,
  items       jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select m.*, public.dish_key(m.name) as dish
      from public.meals m
     where m.user_id = (select auth.uid())
       and btrim(m.name) <> ''
  ),
  -- every item of every meal, counted per dish
  parts as (
    select s.dish,
           public.dish_key(i.item ->> 'name') as ikey,
           (array_agg(i.item ->> 'name' order by s.eaten_at desc))[1] as iname,
           count(*)::int as c
      from mine s
     cross join lateral jsonb_array_elements(case when jsonb_typeof(s.items) = 'array' then s.items else '[]'::jsonb end) as i(item)
     where btrim(coalesce(i.item ->> 'name', '')) <> ''
     group by 1, 2
  ),
  ranked as (
    select p.*, row_number() over (partition by p.dish order by p.c desc, p.iname) as rn from parts p
  )
  select s.dish,
         (array_agg(s.name order by s.eaten_at desc))[1],          -- spelled the way it was last logged
         count(*)::int,
         min(s.eaten_at),
         max(s.eaten_at),
         round(avg(s.calories), 0),
         round(avg(s.protein_g), 1),
         round(avg(s.carbs_g), 1),
         round(avg(s.fat_g), 1),
         (count(*) filter (where s.meal_type = 'breakfast'))::int,
         (count(*) filter (where s.meal_type = 'lunch'))::int,
         (count(*) filter (where s.meal_type = 'dinner'))::int,
         (count(*) filter (where s.meal_type = 'snack'))::int,
         coalesce(
           (select jsonb_agg(jsonb_build_object('key', r.ikey, 'name', r.iname, 'times', r.c) order by r.rn)
              from ranked r
             where r.dish = s.dish and r.rn <= 15),
           '[]'::jsonb)
    from mine s
   group by s.dish
   order by max(s.eaten_at) desc;
$$;

revoke all on function public.meal_dishes() from public, anon;
grant execute on function public.meal_dishes() to authenticated;

-- The most recent times the signed-in person ate one dish, with what was in each meal.
create or replace function public.meal_dish_history(p_key text, p_limit int default 8)
returns table (id uuid, meal_type text, calories numeric, servings numeric, eaten_at timestamptz, items jsonb)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, m.meal_type, m.calories, m.servings, m.eaten_at, m.items
    from public.meals m
   where m.user_id = (select auth.uid())
     and public.dish_key(m.name) = p_key
   order by m.eaten_at desc
   limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.meal_dish_history(text, int) from public, anon;
grant execute on function public.meal_dish_history(text, int) to authenticated;
