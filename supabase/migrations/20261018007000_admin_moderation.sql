-- Admin roles, bans, report idempotency and reliable poll creation.
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  badge_label text not null default 'Topluluk yöneticisi',
  created_at timestamptz not null default now()
);
alter table public.admin_roles enable row level security;
drop policy if exists "Admin badges are public" on public.admin_roles;
create policy "Admin badges are public" on public.admin_roles for select using (true);
revoke all on public.admin_roles from anon, authenticated;
grant select on public.admin_roles to anon, authenticated;

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  issued_by uuid not null references auth.users(id),
  reason text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_bans_active_idx on public.user_bans(user_id, expires_at);
alter table public.user_bans enable row level security;
revoke all on public.user_bans from public, anon, authenticated;

create or replace function public.is_admin(p_user_id uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.admin_roles where user_id = coalesce(p_user_id, (select auth.uid()))); $$;
revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to anon, authenticated;

create or replace function public.is_user_banned(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_bans
    where user_id = p_user_id and (expires_at is null or expires_at > now())
  );
$$;
revoke all on function public.is_user_banned(uuid) from public;
grant execute on function public.is_user_banned(uuid) to authenticated;

create or replace function public.is_current_user_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_admin((select auth.uid())); $$;
revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

-- The trigger already records poll activity; the old direct insert was failing because
-- direct activity inserts are intentionally revoked.
create or replace function public.create_poll(p_question text, p_description text, p_category text, p_options text[])
returns uuid language plpgsql security invoker set search_path = ''
as $$
declare new_poll_id uuid; combined_text text; current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if public.is_user_banned(current_user_id) then raise exception 'Hesabın geçici veya kalıcı olarak kısıtlandı.'; end if;
  if char_length(trim(p_question)) not between 12 and 240 then raise exception 'Question must be 12 to 240 characters'; end if;
  if p_category not in ('technology','gaming','science','current-affairs','society','education','sports','entertainment','philosophy','everyday-life') then raise exception 'Unknown poll category'; end if;
  if p_options is null or array_length(p_options, 1) not between 2 and 4 then raise exception 'Polls need 2 to 4 options'; end if;
  if exists (select 1 from unnest(p_options) as item where char_length(trim(item)) not between 1 and 120) then raise exception 'Options must be 1 to 120 characters'; end if;
  if (select count(distinct lower(trim(item))) from unnest(p_options) as item) <> array_length(p_options, 1) then raise exception 'Options must be unique'; end if;
  combined_text := p_question || ' ' || coalesce(p_description, '') || ' ' || array_to_string(p_options, ' ');
  if not public.moderation_allows(left(combined_text, 1000)) then raise exception 'İçerik topluluk kurallarına uymadığı için yayınlanmadı.' using errcode = 'check_violation'; end if;
  insert into public.polls (created_by, question, description, category, status)
  values (current_user_id, trim(p_question), left(trim(coalesce(p_description, '')), 500), p_category, 'published')
  returning id into new_poll_id;
  insert into public.poll_options (poll_id, label, position)
  select new_poll_id, trim(item), (ordinality - 1)::smallint
  from unnest(p_options) with ordinality as option_rows(item, ordinality);
  return new_poll_id;
end;
$$;
revoke all on function public.create_poll(text, text, text, text[]) from public;
grant execute on function public.create_poll(text, text, text, text[]) to authenticated;

-- Reports are idempotent and are only writable through this function.
revoke insert on public.comment_reports from authenticated;
create or replace function public.report_comment(p_comment_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if p_reason not in ('harassment','hate','spam','privacy','other') then raise exception 'Invalid report reason'; end if;
  insert into public.comment_reports(comment_id, reporter_id, reason)
  values (p_comment_id, current_user_id, p_reason)
  on conflict (comment_id, reporter_id) do nothing;
end;
$$;
revoke all on function public.report_comment(uuid, text) from public;
grant execute on function public.report_comment(uuid, text) to authenticated;

-- Enforce active bans in the existing comment rate-limit function.
create or replace function public.can_post_comment(p_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not public.is_user_banned(p_user_id)
    and (select count(*) < 3 from public.comments where user_id = p_user_id and created_at > now() - interval '1 minute');
$$;
revoke all on function public.can_post_comment(uuid) from public;
grant execute on function public.can_post_comment(uuid) to authenticated;

create or replace function public.admin_delete_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin((select auth.uid())) then raise exception 'Admin permission required'; end if;
  delete from public.comments where id = p_comment_id;
end;
$$;
revoke all on function public.admin_delete_comment(uuid) from public;
grant execute on function public.admin_delete_comment(uuid) to authenticated;

create or replace function public.admin_delete_poll(p_poll_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin((select auth.uid())) then raise exception 'Admin permission required'; end if;
  delete from public.polls where id = p_poll_id;
end;
$$;
revoke all on function public.admin_delete_poll(uuid) from public;
grant execute on function public.admin_delete_poll(uuid) to authenticated;

create or replace function public.admin_ban_user(p_user_id uuid, p_duration_minutes integer, p_reason text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin((select auth.uid())) then raise exception 'Admin permission required'; end if;
  if p_user_id = (select auth.uid()) then raise exception 'Kendi hesabını kısıtlayamazsın'; end if;
  insert into public.user_bans(user_id, issued_by, reason, expires_at)
  values (p_user_id, (select auth.uid()), left(trim(coalesce(p_reason, '')), 280), case when p_duration_minutes is null then null else now() + make_interval(mins => greatest(p_duration_minutes, 1)) end);
end;
$$;
revoke all on function public.admin_ban_user(uuid, integer, text) from public;
grant execute on function public.admin_ban_user(uuid, integer, text) to authenticated;

create or replace function public.admin_unban_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin((select auth.uid())) then raise exception 'Admin permission required'; end if;
  delete from public.user_bans where user_id = p_user_id;
end;
$$;
revoke all on function public.admin_unban_user(uuid) from public;
grant execute on function public.admin_unban_user(uuid) to authenticated;

create or replace function public.admin_list_reports()
returns table (comment_id uuid, comment_content text, comment_user_id uuid, reason text, reported_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.comment_id, c.content, c.user_id, r.reason, r.created_at
  from public.comment_reports r
  join public.comments c on c.id = r.comment_id
  where public.is_admin((select auth.uid()))
  order by r.created_at desc limit 100;
$$;
revoke all on function public.admin_list_reports() from public;
grant execute on function public.admin_list_reports() to authenticated;

-- Make the requested account an admin, if it exists.
insert into public.admin_roles(user_id, badge_label)
select id, 'Topluluk yöneticisi'
from auth.users
where lower(email) = lower('ulas91794@gmail.com')
on conflict (user_id) do update set badge_label = excluded.badge_label;
