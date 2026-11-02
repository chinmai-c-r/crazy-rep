-- ─────────────────────────────────────────────────────────────
-- Diet: add "eggetarian" (vegetarian that also eats eggs)
-- ─────────────────────────────────────────────────────────────
-- The column's check constraint was created inline, so Postgres named it profiles_diet_check.
alter table public.profiles drop constraint if exists profiles_diet_check;
alter table public.profiles
  add constraint profiles_diet_check
  check (diet in ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan'));
