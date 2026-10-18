-- Allow up to three comments per authenticated user per minute.
drop policy if exists "Users add visible comments to published polls" on public.comments;
create policy "Users add visible comments to published polls" on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and moderation_status = 'visible'
    and exists (select 1 from public.polls p where p.id = poll_id and p.status = 'published')
    and (
      select count(*)
      from public.comments recent
      where recent.user_id = (select auth.uid())
        and recent.created_at > now() - interval '1 minute'
    ) < 3
  );
