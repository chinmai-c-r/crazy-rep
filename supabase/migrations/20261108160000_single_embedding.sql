-- One set of vectors. Meals now point at the analysis_cache row for their dish, and searching what you've eaten uses that
-- row's vector, so the separate dish_embeddings table is gone.
--   • analysis_cache.embed_text: what a row's vector is made from (name, what's in it, notes)
--   • meals.cache_key:           the analysis_cache row this meal is an instance of
--   • match_cache_keys():        the rows among a list of keys closest to a query vector
--   • meal_dishes():             also returns the cache keys of each dish's meals

alter table public.analysis_cache add column if not exists embed_text text;

alter table public.meals add column if not exists cache_key text references public.analysis_cache (cache_key) on delete set null;
create index if not exists meals_cache_key_idx on public.meals (user_id, cache_key) where cache_key is not null;
-- Meals still waiting to be linked
create index if not exists meals_unlinked_idx on public.meals (user_id) where cache_key is null;

-- The rows among p_keys nearest to a query vector (the person's own dishes). Server only.
-- The key list is applied first and the distances sorted after, so the vector index (built for the whole table) can't hide matches.
create or replace function public.match_cache_keys(p_embedding extensions.vector(768), p_keys text[], p_count int default 12)
returns table (cache_key text, similarity double precision)
language sql
stable
set search_path = ''
as $$
  with mine as materialized (
    select c.cache_key, c.embedding
      from public.analysis_cache c
     where c.cache_key = any(p_keys)
       and c.embedding is not null
  )
  select m.cache_key, 1 - (m.embedding operator(extensions.<=>) p_embedding) as similarity
    from mine m
   order by m.embedding operator(extensions.<=>) p_embedding
   limit least(greatest(p_count, 1), 40);
$$;

revoke all on function public.match_cache_keys(extensions.vector, text[], int) from public, anon, authenticated;
grant execute on function public.match_cache_keys(extensions.vector, text[], int) to service_role;

-- Dish vectors are retired
drop function if exists public.match_dish_names(extensions.vector, text[], int);
drop function if exists public.set_dish_embeddings(jsonb);
drop function if exists public.missing_dish_embeddings(text[]);
drop table if exists public.dish_embeddings;

-- meal_dishes() gains a column, so it's dropped and created again
drop function if exists public.meal_dishes();

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
  items       jsonb,
  cache_keys  text[]
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
         (array_agg(s.name order by s.eaten_at desc))[1],
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
           '[]'::jsonb),
         coalesce(array_agg(distinct s.cache_key) filter (where s.cache_key is not null), '{}')
    from mine s
   group by s.dish
   order by max(s.eaten_at) desc;
$$;

revoke all on function public.meal_dishes() from public, anon;
grant execute on function public.meal_dishes() to authenticated;
