-- Crazy Rep: initial calorie tracker schema
-- Applied with `npm run db:push`. Never edit after it has been pushed;
-- add a new migration with `npm run db:new <name>` instead.

-- ─────────────────────────────────────────────────────────────
-- Profiles: one row per user, holds daily goals and body metrics
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text,
  sex            text check (sex in ('male', 'female')),
  age            int  check (age between 10 and 120),
  height_cm      numeric(5,1) check (height_cm between 80 and 260),
  weight_kg      numeric(5,1) check (weight_kg between 25 and 400),
  activity_level text not null default 'moderate'
                 check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal           text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain')),
  calorie_goal   int  not null default 2000 check (calorie_goal between 800 and 10000),
  protein_goal_g int  not null default 120  check (protein_goal_g between 0 and 1000),
  carbs_goal_g   int  not null default 220  check (carbs_goal_g between 0 and 1500),
  fat_goal_g     int  not null default 65   check (fat_goal_g between 0 and 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Meals: every scanned (or manually logged) meal
-- ─────────────────────────────────────────────────────────────
create table if not exists public.meals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at        timestamptz not null default now(),
  meal_type       text not null default 'snack' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  name            text not null check (char_length(name) between 1 and 120),
  image_path      text,
  servings        numeric(4,2) not null default 1 check (servings > 0 and servings <= 20),
  calories        numeric(7,1) not null default 0 check (calories >= 0),
  protein_g       numeric(6,1) not null default 0 check (protein_g >= 0),
  carbs_g         numeric(6,1) not null default 0 check (carbs_g >= 0),
  fat_g           numeric(6,1) not null default 0 check (fat_g >= 0),
  fiber_g         numeric(6,1) not null default 0 check (fiber_g >= 0),
  sugar_g         numeric(6,1) not null default 0 check (sugar_g >= 0),
  saturated_fat_g numeric(6,1) not null default 0 check (saturated_fat_g >= 0),
  sodium_mg       numeric(7,1) not null default 0 check (sodium_mg >= 0),
  cholesterol_mg  numeric(7,1) not null default 0 check (cholesterol_mg >= 0),
  health_score    int check (health_score between 1 and 10),
  confidence      numeric(3,2) check (confidence between 0 and 1),
  items           jsonb not null default '[]'::jsonb,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists meals_user_eaten_idx on public.meals (user_id, eaten_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row level security: users only ever see their own rows
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.meals    enable row level security;

drop policy if exists "profiles: read own"   on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: read own"   on public.profiles for select using ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles for update using ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles for insert with check ((select auth.uid()) = id);

drop policy if exists "meals: read own"   on public.meals;
drop policy if exists "meals: insert own" on public.meals;
drop policy if exists "meals: update own" on public.meals;
drop policy if exists "meals: delete own" on public.meals;
create policy "meals: read own"   on public.meals for select using ((select auth.uid()) = user_id);
create policy "meals: insert own" on public.meals for insert with check ((select auth.uid()) = user_id);
create policy "meals: update own" on public.meals for update using ((select auth.uid()) = user_id);
create policy "meals: delete own" on public.meals for delete using ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────
-- Auto-create a profile when someone signs up
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Storage: private bucket for meal photos, one folder per user
-- Files are stored as  <user_id>/<uuid>.jpg
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meal-images', 'meal-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "meal-images: read own"   on storage.objects;
drop policy if exists "meal-images: upload own" on storage.objects;
drop policy if exists "meal-images: delete own" on storage.objects;
create policy "meal-images: read own" on storage.objects for select
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal-images: upload own" on storage.objects for insert
  with check (bucket_id = 'meal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "meal-images: delete own" on storage.objects for delete
  using (bucket_id = 'meal-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
