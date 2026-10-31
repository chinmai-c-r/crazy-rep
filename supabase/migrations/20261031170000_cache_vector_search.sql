-- analysis_cache becomes the single source of truth for meal nutrition:
-- every row gets an embedding so lookups can use vector search (pgvector),
-- and rows remember where their numbers came from.

create extension if not exists vector with schema extensions;

alter table public.analysis_cache
  add column if not exists source      text not null default 'ai',
  add column if not exists search_text text,                       -- name + aliases, used for embeddings and word checks
  add column if not exists cuisine     text,
  add column if not exists serving_g   numeric(7,1),               -- grams the stored analysis is for
  add column if not exists embedding   extensions.vector(768),
  add column if not exists embedded_at timestamptz;

update public.analysis_cache
   set source = case when model = 'usda-fdc' then 'usda' else 'ai' end
 where source = 'ai';

alter table public.analysis_cache drop constraint if exists analysis_cache_source_check;
alter table public.analysis_cache
  add constraint analysis_cache_source_check check (source in ('ai', 'usda', 'indb', 'ifct', 'ai-catalog'));

-- Cosine-distance HNSW index for fast nearest-neighbour search
create index if not exists analysis_cache_embedding_idx
  on public.analysis_cache using hnsw (embedding extensions.vector_cosine_ops);

-- Nearest cached meals to a query embedding. Server-only (secret key).
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
   order by c.embedding operator(extensions.<=>) p_embedding
   limit least(greatest(p_count, 1), 20);
$$;

revoke all on function public.match_analysis_cache(extensions.vector, int) from public, anon, authenticated;
grant execute on function public.match_analysis_cache(extensions.vector, int) to service_role;

-- Bulk-set embeddings: p_rows = [{"cache_key": "...", "embedding": "[0.1,…]"}]. Used by scripts/enrich-cache.ts.
create or replace function public.set_cache_embeddings(p_rows jsonb)
returns int
language sql
set search_path = ''
as $$
  with r as (
    select x.cache_key, x.embedding
      from jsonb_to_recordset(p_rows) as x(cache_key text, embedding text)
  ),
  u as (
    update public.analysis_cache c
       set embedding = r.embedding::extensions.vector, embedded_at = now()
      from r
     where c.cache_key = r.cache_key
    returning 1
  )
  select count(*)::int from u;
$$;

revoke all on function public.set_cache_embeddings(jsonb) from public, anon, authenticated;
grant execute on function public.set_cache_embeddings(jsonb) to service_role;
