create table if not exists public.ai_recommendation_rate_limits (
    user_id uuid primary key references auth.users(id) on delete cascade,
    window_started_at timestamptz not null default now(),
    request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_recommendation_rate_limits enable row level security;

revoke all on table public.ai_recommendation_rate_limits from anon, authenticated;

create or replace function public.consume_ai_recommendation_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    request_allowed boolean := false;
begin
    if current_user_id is null then
        return false;
    end if;

    insert into public.ai_recommendation_rate_limits as limits (
        user_id,
        window_started_at,
        request_count
    ) values (
        current_user_id,
        now(),
        1
    )
    on conflict (user_id) do update
    set
        window_started_at = case
            when limits.window_started_at <= now() - interval '1 hour' then now()
            else limits.window_started_at
        end,
        request_count = case
            when limits.window_started_at <= now() - interval '1 hour' then 1
            else limits.request_count + 1
        end
    where
        limits.window_started_at <= now() - interval '1 hour'
        or limits.request_count < 20
    returning true into request_allowed;

    return coalesce(request_allowed, false);
end;
$$;

revoke all on function public.consume_ai_recommendation_quota() from public, anon;
grant execute on function public.consume_ai_recommendation_quota() to authenticated;