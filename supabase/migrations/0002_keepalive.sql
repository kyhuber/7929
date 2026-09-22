-- Inactivity keepalive (free-tier projects are paused after 7 days with no
-- database activity, which takes the app offline until someone clicks
-- "Restore" in the dashboard). The schedulers in .github/workflows/keepalive.yml
-- and vercel.json call ping() daily; this is the thing they call.

create table keepalive (
  id           boolean primary key default true,
  last_ping_at timestamptz not null default now(),
  ping_count   bigint not null default 0,

  -- One row, forever: a ping is an update, so the table never grows.
  constraint keepalive_singleton check (id)
);

insert into keepalive (id) values (true);

-- RLS on with no policies: the table itself is unreachable over the API.
-- The only way in is ping(), which is security definer and touches nothing else.
alter table keepalive enable row level security;

create function public.ping() returns timestamptz
  language sql
  security definer
  set search_path = ''
as $$
  update public.keepalive
     set last_ping_at = now(),
         ping_count   = ping_count + 1
   where id
  returning last_ping_at;
$$;

-- The schedulers hold the anon key, nothing stronger.
revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;

comment on function public.ping() is
  'Inactivity keepalive: bumps the single keepalive row and returns its new timestamp.';
