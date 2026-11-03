-- ─────────────────────────────────────────────────────────────
-- Keep it simple on the free plan:
--   1. run the reminder job once an hour instead of every 15 minutes
--   2. trim pg_cron's run history daily so it never grows (keep 3 days)
-- ─────────────────────────────────────────────────────────────

-- 1. Hourly reminders. A reminder goes out on the first run at or after its time, so it can arrive up to
--    an hour late (and a missed run is still covered for 90 minutes, see GRACE_MINUTES in lib/reminders.ts).
do $$
begin
  perform cron.unschedule('meal-reminders') where exists (select 1 from cron.job where jobname = 'meal-reminders');
end $$;

select cron.schedule('meal-reminders', '0 * * * *', $$select public.ping_meal_reminders()$$);

-- 2. Daily clean-up of pg_cron's own history (cron.job_run_details gets a row per run, forever).
--    Runs at 03:15 UTC. pg_net already deletes its response log after a few hours by itself.
do $$
begin
  perform cron.unschedule('cron-history-cleanup') where exists (select 1 from cron.job where jobname = 'cron-history-cleanup');
end $$;

select cron.schedule(
  'cron-history-cleanup',
  '15 3 * * *',
  $$delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '3 days'$$
);
