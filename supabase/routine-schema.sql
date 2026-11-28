-- Additive support for custom weekly routines; existing journals remain valid.
begin;
alter table public.traction_documents drop constraint traction_documents_data_check;
alter table public.traction_documents add constraint traction_documents_data_check check ((
  jsonb_typeof(data) = 'object'
  and data->>'version' = '1'
  and (
    data->>'routine' in ('austin','lizzie')
    or (data->>'routine' like 'routine-%' and length(data->>'routine')<=100
      and data->'customRoutines' @> jsonb_build_array(jsonb_build_object('id',data->>'routine')))
  )
  and (not (data ? 'customRoutines') or
    (jsonb_typeof(data->'customRoutines')='array' and jsonb_array_length(data->'customRoutines')<=50))
  and jsonb_typeof(data->'sessions')='array'
  and jsonb_typeof(data->'sets')='array'
  and jsonb_typeof(data->'skips')='array'
  and jsonb_typeof(data->'replacements')='array'
  and jsonb_typeof(data->'profile')='object'
  and data->'drafts'='{}'::jsonb
) is true);
commit;
