-- ─────────────────────────────────────────────────────────────
-- Coach chat threads: several conversations per user
-- ─────────────────────────────────────────────────────────────
create table public.chat_threads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null default 'New chat' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_threads_user_updated_idx on public.chat_threads (user_id, updated_at desc);

alter table public.chat_threads enable row level security;
create policy "chat threads: read own"   on public.chat_threads for select using ((select auth.uid()) = user_id);
create policy "chat threads: insert own" on public.chat_threads for insert with check ((select auth.uid()) = user_id);
create policy "chat threads: update own" on public.chat_threads for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "chat threads: delete own" on public.chat_threads for delete using ((select auth.uid()) = user_id);

-- Messages belong to a thread; deleting a thread deletes its messages.
alter table public.chat_messages add column thread_id uuid references public.chat_threads (id) on delete cascade;

-- Existing history becomes one thread per user so nothing is lost.
insert into public.chat_threads (user_id, title, created_at, updated_at)
select user_id, 'Earlier chat', min(created_at), max(created_at)
  from public.chat_messages
 group by user_id;

update public.chat_messages m
   set thread_id = t.id
  from public.chat_threads t
 where t.user_id = m.user_id
   and m.thread_id is null;

alter table public.chat_messages alter column thread_id set not null;
create index chat_messages_thread_time_idx on public.chat_messages (thread_id, created_at);

-- A message can only be written into one of the user's own threads.
drop policy "chat: insert own" on public.chat_messages;
create policy "chat: insert own" on public.chat_messages for insert
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.chat_threads t where t.id = thread_id and t.user_id = (select auth.uid()))
  );
