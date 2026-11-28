-- Traction account journals. Apply only to the Traction_PWA Supabase project.
begin;
create table public.traction_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  data jsonb not null check ((
    jsonb_typeof(data) = 'object'
    and data->>'version' = '1'
    and (
      data->>'routine' in ('austin', 'lizzie')
      or (data->>'routine' like 'routine-%' and length(data->>'routine') <= 100
        and data->'customRoutines' @> jsonb_build_array(jsonb_build_object('id', data->>'routine')))
    )
    and (not (data ? 'customRoutines') or
      (jsonb_typeof(data->'customRoutines') = 'array' and jsonb_array_length(data->'customRoutines') <= 50))
    and jsonb_typeof(data->'sessions') = 'array'
    and jsonb_typeof(data->'sets') = 'array'
    and jsonb_typeof(data->'skips') = 'array'
    and jsonb_typeof(data->'replacements') = 'array'
    and jsonb_typeof(data->'profile') = 'object'
    and data->'drafts' = '{}'::jsonb
  ) is true),
  updated_at timestamptz not null default now()
);
alter table public.traction_documents enable row level security;
revoke all on public.traction_documents from public, anon, authenticated;
grant select, insert, update on public.traction_documents to authenticated;
create policy "Read your own journal" on public.traction_documents
  for select to authenticated using (
    (select auth.uid()) = user_id
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false'
  );
create policy "Create your own journal" on public.traction_documents
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false'
  );
create policy "Update your own journal" on public.traction_documents
  for update to authenticated using (
    (select auth.uid()) = user_id
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false'
  ) with check (
    (select auth.uid()) = user_id
    and coalesce((select auth.jwt())->>'is_anonymous', 'false') = 'false'
  );
create function public.save_traction_document(expected_revision bigint, document jsonb, owner_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.traction_documents;
begin
  if auth.uid() is null or auth.uid() is distinct from owner_id or coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' then
    raise exception 'Sign in to your account to save' using errcode = '28000';
  end if;
  if expected_revision is null or expected_revision < 0 then
    raise exception 'Invalid journal revision' using errcode = '22023';
  end if;
  if octet_length(document::text) > 10000000 then
    raise exception 'Journal exceeds the 10 MB storage limit' using errcode = '22023';
  end if;
  if expected_revision = 0 then
    insert into public.traction_documents(user_id, revision, data)
    values(auth.uid(), 1, document)
    on conflict(user_id) do nothing returning * into saved;
  else
    update public.traction_documents
    set data = document, revision = revision + 1, updated_at = now()
    where user_id = auth.uid() and revision = expected_revision
    returning * into saved;
  end if;
  if saved.user_id is null then
    raise exception 'Journal changed on another device' using errcode = '40001';
  end if;
  return jsonb_build_object('data', saved.data, 'revision', saved.revision);
end;
$$;
revoke all on function public.save_traction_document(bigint, jsonb, uuid) from public, anon;
grant execute on function public.save_traction_document(bigint, jsonb, uuid) to authenticated;
commit;
