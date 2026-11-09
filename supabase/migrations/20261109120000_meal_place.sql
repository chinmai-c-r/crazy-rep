-- Where a meal was eaten ("Home", "Office", or any name the person types). Optional.
alter table public.meals add column if not exists place text check (place is null or char_length(place) between 1 and 40);
