-- Publish only aggregate counts for realtime updates; never broadcast individual vote records.
create table if not exists public.poll_results (
  poll_id uuid not null,
  option_id uuid not null,
  vote_count bigint not null default 0 check (vote_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (poll_id, option_id),
  foreign key (poll_id) references public.polls(id) on delete cascade,
  foreign key (poll_id, option_id) references public.poll_options(poll_id, id) on delete cascade
);
alter table public.poll_results enable row level security;
drop policy if exists "Public aggregate counts are readable" on public.poll_results;
create policy "Public aggregate counts are readable" on public.poll_results for select using (true);
grant select on public.poll_results to anon, authenticated;

insert into public.poll_results (poll_id, option_id, vote_count)
select p.id, o.id, count(v.id)::bigint
from public.polls p
join public.poll_options o on o.poll_id = p.id
left join public.votes v on v.poll_id = p.id and v.option_id = o.id
where p.status = 'published'
group by p.id, o.id
on conflict (poll_id, option_id) do update
set vote_count = excluded.vote_count, updated_at = now();

create or replace function public.refresh_public_poll_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.poll_results (poll_id, option_id, vote_count, updated_at)
  values (new.poll_id, new.option_id, 1, now())
  on conflict (poll_id, option_id) do update
  set vote_count = public.poll_results.vote_count + 1, updated_at = now();
  return new;
end;
$$;
revoke all on function public.refresh_public_poll_result() from public;

drop trigger if exists votes_update_public_aggregate on public.votes;
create trigger votes_update_public_aggregate
after insert on public.votes
for each row execute function public.refresh_public_poll_result();

create or replace function public.get_poll_results()
returns table (poll_id uuid, option_id uuid, vote_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.poll_id, r.option_id, r.vote_count
  from public.poll_results r
  join public.polls p on p.id = r.poll_id
  where p.status = 'published';
$$;
revoke all on function public.get_poll_results() from public;
grant execute on function public.get_poll_results() to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'poll_results') then
    alter publication supabase_realtime add table public.poll_results;
  end if;
end $$;
