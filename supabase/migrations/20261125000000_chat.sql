-- Chat logging, intros, rate limiting and the daily token budget for arshakil.com/chat.
-- RLS is enabled with NO policies: only the service role (server) can read or write.

create extension if not exists pgcrypto;

create table if not exists public.chat_sessions (
  id uuid primary key,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  user_agent_family text
);

create table if not exists public.chat_messages (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  tool_name text,
  input_tokens integer,
  output_tokens integer,
  cache_read_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on public.chat_messages (session_id, created_at);
create index if not exists chat_messages_created_idx on public.chat_messages (created_at);

create table if not exists public.intros (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid,
  name text not null check (char_length(name) between 1 and 80),
  email text not null,
  topic text,
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'archived'))
);

create table if not exists public.rate_windows (
  ip_hash text not null,
  kind text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip_hash, kind, window_start)
);
create index if not exists rate_windows_start_idx on public.rate_windows (window_start);

create table if not exists public.daily_budget (
  day date primary key,
  output_tokens bigint not null default 0
);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.intros enable row level security;
alter table public.rate_windows enable row level security;
alter table public.daily_budget enable row level security;

revoke all on public.chat_sessions, public.chat_messages, public.intros, public.rate_windows, public.daily_budget
  from anon, authenticated;

-- Atomically counts one request in the caller's hourly and daily windows and reports whether
-- both are within limits. Rejected attempts still count, so hammering doesn't reset anything.
create or replace function public.rate_consume(p_hash text, p_kind text, p_hour_limit integer, p_day_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  hour_count integer;
  day_count integer;
begin
  insert into rate_windows (ip_hash, kind, window_start, count)
  values (p_hash, p_kind || ':hour', date_trunc('hour', now()), 1)
  on conflict (ip_hash, kind, window_start) do update set count = rate_windows.count + 1
  returning count into hour_count;

  insert into rate_windows (ip_hash, kind, window_start, count)
  values (p_hash, p_kind || ':day', date_trunc('day', now(), 'UTC'), 1)
  on conflict (ip_hash, kind, window_start) do update set count = rate_windows.count + 1
  returning count into day_count;

  return hour_count <= p_hour_limit and day_count <= p_day_limit;
end;
$$;

-- True while today's (UTC) estimated output tokens are under the limit.
create or replace function public.budget_available(p_limit bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select output_tokens from daily_budget where day = (now() at time zone 'UTC')::date),
    0
  ) < p_limit;
$$;

-- Adds a turn's output tokens to today's (UTC) counter and returns the new total.
create or replace function public.budget_add(p_tokens integer)
returns bigint
language sql
security definer
set search_path = public
as $$
  insert into daily_budget (day, output_tokens)
  values ((now() at time zone 'UTC')::date, greatest(p_tokens, 0))
  on conflict (day) do update set output_tokens = daily_budget.output_tokens + excluded.output_tokens
  returning output_tokens;
$$;

revoke all on function public.rate_consume(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.budget_available(bigint) from public, anon, authenticated;
revoke all on function public.budget_add(integer) from public, anon, authenticated;
grant execute on function public.rate_consume(text, text, integer, integer) to service_role;
grant execute on function public.budget_available(bigint) to service_role;
grant execute on function public.budget_add(integer) to service_role;
