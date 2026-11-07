-- ─────────────────────────────────────────────────────────────
-- Search what you've eaten, by name (History → Meals).
--   • meal_dishes():        your meals grouped into dishes (same name = same dish), with counts and averages
--   • meal_dish_history():  the times you ate one dish
--   • dish_embeddings:      a vector for each dish name, so "curd" can find "dahi rice" (server-only, matched
--                           only against the signed-in person's own names)
-- ─────────────────────────────────────────────────────────────

-- "Dal  Rice " and "dal rice" are the same dish.
create or replace function public.dish_key(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(p_name), '\s+', ' ', 'g'));
$$;

-- One row per dish the signed-in person has logged, most recently eaten first.
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
  snack       int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select public.dish_key(m.name),
         (array_agg(m.name order by m.eaten_at desc))[1],          -- spelled the way it was last logged
         count(*)::int,
         min(m.eaten_at),
         max(m.eaten_at),
         round(avg(m.calories), 0),
         round(avg(m.protein_g), 1),
         round(avg(m.carbs_g), 1),
         round(avg(m.fat_g), 1),
         (count(*) filter (where m.meal_type = 'breakfast'))::int,
         (count(*) filter (where m.meal_type = 'lunch'))::int,
         (count(*) filter (where m.meal_type = 'dinner'))::int,
         (count(*) filter (where m.meal_type = 'snack'))::int
    from public.meals m
   where m.user_id = (select auth.uid())
     and btrim(m.name) <> ''
   group by 1
   order by max(m.eaten_at) desc;
$$;

revoke all on function public.meal_dishes() from public, anon;
grant execute on function public.meal_dishes() to authenticated;

-- The most recent times the signed-in person ate one dish.
create or replace function public.meal_dish_history(p_key text, p_limit int default 8)
returns table (id uuid, meal_type text, calories numeric, servings numeric, eaten_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.id, m.meal_type, m.calories, m.servings, m.eaten_at
    from public.meals m
   where m.user_id = (select auth.uid())
     and public.dish_key(m.name) = p_key
   order by m.eaten_at desc
   limit least(greatest(p_limit, 1), 30);
$$;

revoke all on function public.meal_dish_history(text, int) from public, anon;
grant execute on function public.meal_dish_history(text, int) to authenticated;

-- ── Vectors for dish names ─────────────────────────────────────
create extension if not exists vector with schema extensions;

-- Keyed by the normalised name only (no user), written and read by the server alone. Row-level security is on with no
-- policies, so the app's own users can't read it; the server only ever matches it against that user's own names.
create table if not exists public.dish_embeddings (
  name_key    text primary key,
  embedding   extensions.vector(768) not null,
  embedded_at timestamptz not null default now()
);
alter table public.dish_embeddings enable row level security;

create index if not exists dish_embeddings_embedding_idx
  on public.dish_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- Which of these names don't have a vector yet.
create or replace function public.missing_dish_embeddings(p_keys text[])
returns table (name_key text)
language sql
stable
set search_path = ''
as $$
  select k
    from unnest(p_keys) as k
   where not exists (select 1 from public.dish_embeddings e where e.name_key = k);
$$;

-- Store vectors: p_rows = [{"name_key": "...", "embedding": "[0.1,…]"}]
create or replace function public.set_dish_embeddings(p_rows jsonb)
returns int
language sql
set search_path = ''
as $$
  with r as (
    select x.name_key, x.embedding
      from jsonb_to_recordset(p_rows) as x(name_key text, embedding text)
  ),
  u as (
    insert into public.dish_embeddings (name_key, embedding)
    select r.name_key, r.embedding::extensions.vector from r
    on conflict (name_key) do update set embedding = excluded.embedding, embedded_at = now()
    returning 1
  )
  select count(*)::int from u;
$$;

-- The names among p_keys closest in meaning to a query vector.
create or replace function public.match_dish_names(p_embedding extensions.vector(768), p_keys text[], p_count int default 12)
returns table (name_key text, similarity double precision)
language sql
stable
set search_path = ''
as $$
  select e.name_key, 1 - (e.embedding operator(extensions.<=>) p_embedding) as similarity
    from public.dish_embeddings e
   where e.name_key = any(p_keys)
   order by e.embedding operator(extensions.<=>) p_embedding
   limit least(greatest(p_count, 1), 40);
$$;

revoke all on function public.missing_dish_embeddings(text[]) from public, anon, authenticated;
revoke all on function public.set_dish_embeddings(jsonb) from public, anon, authenticated;
revoke all on function public.match_dish_names(extensions.vector, text[], int) from public, anon, authenticated;
grant execute on function public.missing_dish_embeddings(text[]) to service_role;
grant execute on function public.set_dish_embeddings(jsonb) to service_role;
grant execute on function public.match_dish_names(extensions.vector, text[], int) to service_role;
