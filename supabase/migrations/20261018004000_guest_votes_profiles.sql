-- Guest voting and public profile customization.
alter table public.profiles add column if not exists avatar_url text not null default '';
alter table public.profiles add column if not exists banner_url text not null default '';
alter table public.profiles add constraint profiles_avatar_url_length check (char_length(avatar_url) <= 500);
alter table public.profiles add constraint profiles_banner_url_length check (char_length(banner_url) <= 500);
alter table public.profiles add constraint profiles_bio_length check (char_length(bio) <= 280);

create table if not exists public.guest_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  constraint guest_votes_option_same_poll_fk foreign key (poll_id, option_id) references public.poll_options(poll_id, id) on delete cascade,
  constraint one_guest_vote_per_poll unique (poll_id, visitor_id)
);
create index if not exists guest_votes_option_idx on public.guest_votes (poll_id, option_id);
alter table public.guest_votes enable row level security;
revoke all on public.guest_votes from anon, authenticated;

drop function if exists public.cast_guest_vote(uuid, uuid, uuid);
create or replace function public.cast_guest_vote(p_poll_id uuid, p_option_id uuid, p_visitor_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_visitor_id is null then raise exception 'Visitor identity required'; end if;
  if not exists (select 1 from public.polls where id = p_poll_id and status = 'published') then
    raise exception 'Poll is not available';
  end if;
  insert into public.guest_votes(poll_id, option_id, visitor_id)
  values (p_poll_id, p_option_id, p_visitor_id);
exception
  when unique_violation then
    raise exception 'Bu ankette zaten oy kullandın.';
end;
$$;
revoke all on function public.cast_guest_vote(uuid, uuid, uuid) from public;
grant execute on function public.cast_guest_vote(uuid, uuid, uuid) to anon, authenticated;

create or replace function public.get_guest_votes(p_visitor_id uuid)
returns table (poll_id uuid, option_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select gv.poll_id, gv.option_id
  from public.guest_votes gv
  where gv.visitor_id = p_visitor_id;
$$;
revoke all on function public.get_guest_votes(uuid) from public;
grant execute on function public.get_guest_votes(uuid) to anon, authenticated;

create or replace function public.get_poll_results()
returns table (poll_id uuid, option_id uuid, vote_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select combined.poll_id, combined.option_id, count(*)::bigint
  from (
    select v.poll_id, v.option_id from public.votes v
    union all
    select gv.poll_id, gv.option_id from public.guest_votes gv
  ) combined
  join public.polls p on p.id = combined.poll_id
  where p.status = 'published'
  group by combined.poll_id, combined.option_id;
$$;
revoke all on function public.get_poll_results() from public;
grant execute on function public.get_poll_results() to anon, authenticated;
