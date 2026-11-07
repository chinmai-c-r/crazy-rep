-- Marks a past-meals sync in progress so two runs (two tabs, a double tap) can't send the same meals twice.
alter table public.google_health_connections add column backfill_at timestamptz;
