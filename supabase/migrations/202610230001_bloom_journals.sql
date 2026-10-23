-- Apply to the selected project only. Journals contain encrypted ciphertext.
create table if not exists public.bloom_journals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  body text not null,
  revision integer not null default 0 check (revision >= 0)
);
alter table public.bloom_journals enable row level security;
revoke all on public.bloom_journals from anon;
grant select, insert, update on public.bloom_journals to authenticated;
drop policy if exists bloom_owner_select on public.bloom_journals;
create policy bloom_owner_select on public.bloom_journals for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists bloom_owner_insert on public.bloom_journals;
create policy bloom_owner_insert on public.bloom_journals for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists bloom_owner_update on public.bloom_journals;
create policy bloom_owner_update on public.bloom_journals for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Dedicated project only: deletes the signed-in auth account and cascades journals.
create or replace function public.delete_own_bloom_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_own_bloom_account() from public, anon;
grant execute on function public.delete_own_bloom_account() to authenticated;
