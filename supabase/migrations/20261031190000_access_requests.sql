-- People asking for access from the landing page. Approve someone by adding
-- their email to the sign-in-users flag in LaunchDarkly, then set status.

create table public.access_requests (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  name        text,
  message     text,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint access_requests_email_check check (email = lower(email) and length(email) <= 254),
  constraint access_requests_name_check check (length(name) <= 80),
  constraint access_requests_message_check check (length(message) <= 500)
);

-- One request per email
create unique index access_requests_email_key on public.access_requests (email);
create index access_requests_status_created_idx on public.access_requests (status, created_at desc);

-- Only the server (secret key) reads and writes requests: no policies means
-- the publishable key gets nothing, so emails can't be listed from the browser.
alter table public.access_requests enable row level security;
revoke all on public.access_requests from anon, authenticated;
