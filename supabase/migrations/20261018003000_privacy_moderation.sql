-- Privacy, account deletion, reporting and abuse controls.
-- Anonymous sign-ins remain disabled; all write policies target authenticated users.

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(user_id) on delete cascade,
  reason text not null check (reason in ('harassment','hate','spam','privacy','other')),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_id)
);
create index if not exists comment_reports_created_idx on public.comment_reports (created_at desc);

alter table public.comment_reports enable row level security;

drop policy if exists "Users report comments" on public.comment_reports;
create policy "Users report comments" on public.comment_reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and not exists (
      select 1 from public.comment_reports r
      where r.reporter_id = (select auth.uid())
        and r.created_at > now() - interval '1 hour'
    )
  );

drop policy if exists "Users read their own reports" on public.comment_reports;
create policy "Users read their own reports" on public.comment_reports
  for select to authenticated using (reporter_id = (select auth.uid()));

grant select, insert on public.comment_reports to authenticated;

-- Replace the comment insert policy with a database-enforced 3 comments/minute limit.
drop policy if exists "Users add visible comments to published polls" on public.comments;
create policy "Users add visible comments to published polls" on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and moderation_status = 'visible'
    and exists (select 1 from public.polls p where p.id = poll_id and p.status = 'published')
    and not exists (
      select 1 from public.comments recent
      where recent.user_id = (select auth.uid())
        and recent.created_at > now() - interval '1 minute'
    )
  );

create or replace function public.report_comment(
  p_comment_id uuid,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_reason not in ('harassment','hate','spam','privacy','other') then
    raise exception 'Invalid report reason';
  end if;
  insert into public.comment_reports(comment_id, reporter_id, reason)
  values (p_comment_id, (select auth.uid()), p_reason);
exception
  when unique_violation then
    raise exception 'Bu yorumu zaten bildirdin.';
end;
$$;
revoke all on function public.report_comment(uuid, text) from public;
grant execute on function public.report_comment(uuid, text) to authenticated;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  -- Delete user-owned content and security records first. Cascades remove votes,
  -- comments, reports and profile data linked to the account.
  delete from public.polls where created_by = current_user_id;
  delete from public.comment_reports where reporter_id = current_user_id;
  delete from public.user_activity where user_id = current_user_id;
  delete from auth.users where id = current_user_id;
end;
$$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
