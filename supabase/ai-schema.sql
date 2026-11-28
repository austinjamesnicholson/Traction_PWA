-- Applied to the Traction_PWA project only. The private table cannot be reset by clients.
begin;
create schema if not exists traction_private;
revoke all on schema traction_private from public, anon;
grant usage on schema traction_private to authenticated;
create table traction_private.ai_recommendation_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check(request_count between 0 and 20)
);
alter table traction_private.ai_recommendation_rate_limits enable row level security;
create policy "No direct quota access" on traction_private.ai_recommendation_rate_limits
  for all to authenticated using(false) with check(false);
revoke all on traction_private.ai_recommendation_rate_limits from public, anon, authenticated;
create function traction_private.consume_ai_recommendation_quota()
returns boolean language plpgsql security definer set search_path = '' as $$
declare current_user_id uuid:=auth.uid(); allowed boolean:=false;
begin
  if current_user_id is null or coalesce(auth.jwt()->>'is_anonymous','false')='true' then return false; end if;
  insert into traction_private.ai_recommendation_rate_limits as limits(user_id,window_started_at,request_count)
  values(current_user_id,now(),1)
  on conflict(user_id) do update set
    window_started_at=case when limits.window_started_at<=now()-interval '1 hour' then now() else limits.window_started_at end,
    request_count=case when limits.window_started_at<=now()-interval '1 hour' then 1 else limits.request_count+1 end
  where limits.window_started_at<=now()-interval '1 hour' or limits.request_count<20
  returning true into allowed;
  return coalesce(allowed,false);
end;
$$;
revoke all on function traction_private.consume_ai_recommendation_quota() from public,anon;
grant execute on function traction_private.consume_ai_recommendation_quota() to authenticated;
create function public.consume_ai_recommendation_quota()
returns boolean language sql security invoker set search_path = ''
as $$ select traction_private.consume_ai_recommendation_quota(); $$;
revoke all on function public.consume_ai_recommendation_quota() from public,anon;
grant execute on function public.consume_ai_recommendation_quota() to authenticated;
commit;
