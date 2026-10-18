-- Fix the recursive comments RLS policy and enforce moderation in the database.
create or replace function public.can_post_comment(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) < 3
  from public.comments
  where user_id = p_user_id
    and created_at > now() - interval '1 minute';
$$;
revoke all on function public.can_post_comment(uuid) from public;
grant execute on function public.can_post_comment(uuid) to authenticated;

drop policy if exists "Users add visible comments to published polls" on public.comments;
create policy "Users add visible comments to published polls" on public.comments
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and moderation_status = 'visible'
  and exists (select 1 from public.polls p where p.id = poll_id and p.status = 'published')
  and public.can_post_comment((select auth.uid()))
);

create or replace function public.moderation_allows(p_text text)
returns boolean
language sql
immutable
as $$
  select length(trim(coalesce(p_text, ''))) > 0
    and length(p_text) <= 1000
    and lower(p_text) !~ '(orospu|s[ıi]k[a-zçğıöşü]*|amk|aq|pi[cç][a-zçğıöşü]*|ger[iı]z[a-zçğıöşü]*|salak|aptal|[ıi]bne|yarrak|gavat|şerefsiz|haysiyetsiz)';
$$;
revoke all on function public.moderation_allows(text) from public;
grant execute on function public.moderation_allows(text) to authenticated;

create or replace function public.enforce_comment_moderation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.moderation_allows(new.content) then
    raise exception 'İçerik topluluk kurallarına uymadığı için gönderilmedi.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists comments_moderation_guard on public.comments;
create trigger comments_moderation_guard
before insert on public.comments
for each row execute function public.enforce_comment_moderation();

-- Rebuild poll creation with the same server-side content gate.
create or replace function public.create_poll(p_question text, p_description text, p_category text, p_options text[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_poll_id uuid;
  combined_text text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_question)) not between 12 and 240 then raise exception 'Question must be 12 to 240 characters'; end if;
  if p_category not in ('technology','gaming','science','current-affairs','society','education','sports','entertainment','philosophy','everyday-life') then raise exception 'Unknown poll category'; end if;
  if p_options is null or array_length(p_options, 1) not between 2 and 4 then raise exception 'Polls need 2 to 4 options'; end if;
  if exists (select 1 from unnest(p_options) as item where char_length(trim(item)) not between 1 and 120) then raise exception 'Options must be 1 to 120 characters'; end if;
  if (select count(distinct lower(trim(item))) from unnest(p_options) as item) <> array_length(p_options, 1) then raise exception 'Options must be unique'; end if;
  combined_text := p_question || ' ' || coalesce(p_description, '') || ' ' || array_to_string(p_options, ' ');
  if not public.moderation_allows(left(combined_text, 1000)) then raise exception 'İçerik topluluk kurallarına uymadığı için yayınlanmadı.' using errcode = 'check_violation'; end if;
  insert into public.polls (created_by, question, description, category, status)
  values ((select auth.uid()), trim(p_question), left(trim(coalesce(p_description, '')), 500), p_category, 'published')
  returning id into new_poll_id;
  insert into public.poll_options (poll_id, label, position)
  select new_poll_id, trim(item), (ordinality - 1)::smallint
  from unnest(p_options) with ordinality as option_rows(item, ordinality);
  insert into public.user_activity (user_id, poll_id, activity_type)
  values ((select auth.uid()), new_poll_id, 'poll_created');
  return new_poll_id;
end;
$$;
revoke all on function public.create_poll(text, text, text, text[]) from public;
grant execute on function public.create_poll(text, text, text, text[]) to authenticated;
