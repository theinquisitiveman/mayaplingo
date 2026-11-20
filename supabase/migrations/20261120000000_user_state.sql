-- Per-learner saved state. Each user can only ever read or write their own row and recordings.

create table public.user_state (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  progress    jsonb not null default '{}'::jsonb,
  settings    jsonb not null default '{}'::jsonb,
  corrections jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  -- Guard against abuse: real state is a few KB.
  constraint user_state_size check (
    pg_column_size(progress) + pg_column_size(settings) + pg_column_size(corrections) < 512 * 1024
  ),
  constraint user_state_shapes check (
    jsonb_typeof(progress) = 'object' and jsonb_typeof(settings) = 'object' and jsonb_typeof(corrections) = 'object'
  )
);

alter table public.user_state enable row level security;

create policy "read own state" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own state" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own state" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.user_state from anon;
grant select, insert, update on public.user_state to authenticated;

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger user_state_touch before update on public.user_state
  for each row execute function public.touch_updated_at();

-- Pronunciation recordings: private bucket, one folder per user ("<user id>/<item id>").
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recordings', 'recordings', false, 2 * 1024 * 1024, array['audio/mp4', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/aac', 'audio/wav']);

create policy "read own recordings" on storage.objects for select to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "upload own recordings" on storage.objects for insert to authenticated
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "replace own recordings" on storage.objects for update to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "delete own recordings" on storage.objects for delete to authenticated
  using (bucket_id = 'recordings' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Let a learner delete their own account. Their state row cascades; the app removes recordings first.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
