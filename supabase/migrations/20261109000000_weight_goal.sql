-- Weight goal: where the user wants to get to, and how fast.
-- weekly_rate_kg is the chosen pace (kg per week); months to goal is worked out from it, never stored.
alter table public.profiles
  add column if not exists target_weight_kg numeric(5,1) check (target_weight_kg between 25 and 400),
  add column if not exists weekly_rate_kg   numeric(3,2) check (weekly_rate_kg between 0.1 and 1.5);
