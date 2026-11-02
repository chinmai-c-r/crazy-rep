-- ─────────────────────────────────────────────────────────────
-- Diet preference: used by the coach, meal ideas and the "heads up" on results
-- ─────────────────────────────────────────────────────────────
-- Everyone starts as vegetarian (new sign-ups and existing profiles alike) and can change it on the profile page.
alter table public.profiles
  add column diet text not null default 'vegetarian'
  check (diet in ('vegetarian', 'non_vegetarian', 'vegan'));
