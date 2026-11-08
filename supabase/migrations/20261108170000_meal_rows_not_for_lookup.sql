-- Rows made from your own meals (to make them searchable) must never be used as a food's nutrition. They carried every item
-- of one meal, so typing "rice sambar" later brought back the extras that meal had. They now live under their own keys
-- ("meal:rice sambar"), have their own source, and are left out of every nutrition lookup.

alter table public.analysis_cache drop constraint if exists analysis_cache_source_check;
alter table public.analysis_cache
  add constraint analysis_cache_source_check check (source in ('ai', 'usda', 'indb', 'ifct', 'ai-catalog', 'meal'));

-- Meals follow their row when its key changes
alter table public.meals drop constraint if exists meals_cache_key_fkey;
alter table public.meals
  add constraint meals_cache_key_fkey foreign key (cache_key) references public.analysis_cache (cache_key) on update cascade on delete set null;

-- Move the rows already made from meals into their own key space (the meals that point at them follow)
update public.analysis_cache
   set cache_key = 'meal:' || cache_key, source = 'meal'
 where model = 'meal' and cache_key not like 'meal:%';
update public.analysis_cache set source = 'meal' where model = 'meal' and source <> 'meal';

-- Food lookups by meaning skip them
create or replace function public.match_analysis_cache(p_embedding extensions.vector(768), p_count int default 8)
returns table (
  cache_key   text,
  name        text,
  portion     text,
  search_text text,
  source      text,
  serving_g   numeric,
  analysis    jsonb,
  similarity  double precision
)
language sql
stable
set search_path = ''
as $$
  select c.cache_key, c.name, c.portion, c.search_text, c.source, c.serving_g, c.analysis,
         1 - (c.embedding operator(extensions.<=>) p_embedding) as similarity
    from public.analysis_cache c
   where c.embedding is not null
     and c.notes is null
     and c.source <> 'meal'
   order by c.embedding operator(extensions.<=>) p_embedding
   limit least(greatest(p_count, 1), 20);
$$;
