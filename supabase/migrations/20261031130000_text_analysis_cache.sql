-- Text-only meal analyses are cached so the same meal name (with the same
-- portion and notes) never costs a second AI call. Photo analyses are never
-- cached because every photo is different.

create table public.analysis_cache (
  cache_key     text primary key,           -- normalised "name|portion|notes"
  name          text not null,
  portion       text,
  notes         text,
  analysis      jsonb not null,             -- validated AI response
  model         text,
  hits          int  not null default 0,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);

-- Only the server (secret key) reads and writes this table: no policies means
-- the publishable key gets nothing, so users can't read or poison the cache.
alter table public.analysis_cache enable row level security;

-- Count a cache hit atomically without a read-modify-write round trip.
create or replace function public.touch_analysis_cache(p_key text)
returns void
language sql
security definer set search_path = ''
as $$
  update public.analysis_cache
     set hits = hits + 1, last_used_at = now()
   where cache_key = p_key;
$$;

revoke all on function public.touch_analysis_cache(text) from public, anon, authenticated;
grant execute on function public.touch_analysis_cache(text) to service_role;

-- Remember how each meal was estimated (shown in the UI).
alter table public.meals
  add column source text not null default 'photo'
  check (source in ('photo', 'text', 'cache'));
