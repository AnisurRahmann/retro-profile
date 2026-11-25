-- 90-day retention for chat logs (stated on /privacy), plus housekeeping for rate windows.
-- Requires the pg_cron extension (Supabase: Database → Extensions → pg_cron, or the line below).
-- Alternative if pg_cron is unavailable: call public.purge_chat_logs() daily from a Vercel Cron job
-- (see docs/PROGRESS.md → Deploy).

create extension if not exists pg_cron with schema extensions;

create or replace function public.purge_chat_logs()
returns void
language sql
security definer
set search_path = public
as $$
  delete from chat_messages where created_at < now() - interval '90 days';
  delete from chat_sessions s
    where s.created_at < now() - interval '90 days'
      and not exists (select 1 from chat_messages m where m.session_id = s.id);
  delete from rate_windows where window_start < now() - interval '2 days';
  delete from daily_budget where day < (now() at time zone 'UTC')::date - 90;
$$;

revoke all on function public.purge_chat_logs() from public, anon, authenticated;
grant execute on function public.purge_chat_logs() to service_role;

select cron.schedule('purge-chat-logs', '17 3 * * *', $$select public.purge_chat_logs();$$);
