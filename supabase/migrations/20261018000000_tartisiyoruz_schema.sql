-- Tartışıyoruz initial schema. Apply only to the dedicated project created for this app.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now(),
  constraint profiles_username_shape check (username ~ '^[a-z0-9_]{3,30}$')
);
create unique index if not exists profiles_username_unique on public.profiles (lower(username));

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(user_id) on delete set null,
  question text not null,
  description text not null default '',
  category text not null check (category in ('technology','gaming','science','current-affairs','society','education','sports','entertainment','philosophy','everyday-life')),
  status text not null default 'published' check (status in ('draft','published','hidden')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  constraint polls_question_length check (char_length(trim(question)) between 12 and 240)
);
create unique index if not exists polls_question_unique on public.polls (lower(trim(question)));
create index if not exists polls_recent_idx on public.polls (status, created_at desc);
create index if not exists polls_category_idx on public.polls (category, created_at desc);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 120),
  position smallint not null check (position between 0 and 3),
  created_at timestamptz not null default now(),
  unique (poll_id, position),
  unique (poll_id, id)
);
create index if not exists poll_options_poll_idx on public.poll_options (poll_id, position);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint votes_option_same_poll_fk foreign key (poll_id, option_id) references public.poll_options(poll_id, id) on delete cascade,
  constraint one_vote_per_user_poll unique (poll_id, user_id)
);
create index if not exists votes_option_idx on public.votes (poll_id, option_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  moderation_status text not null default 'visible' check (moderation_status in ('visible','pending','hidden')),
  created_at timestamptz not null default now()
);
create index if not exists comments_poll_idx on public.comments (poll_id, moderation_status, created_at desc);

create table if not exists public.user_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  poll_id uuid references public.polls(id) on delete set null,
  activity_type text not null check (activity_type in ('vote','comment','poll_created')),
  created_at timestamptz not null default now()
);
create index if not exists user_activity_leaderboard_idx on public.user_activity (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := lower(coalesce(new.raw_user_meta_data ->> 'preferred_username', split_part(coalesce(new.email, 'kullanici'), '@', 1)));
  requested_name := regexp_replace(requested_name, '[^a-z0-9_]', '_', 'g');
  requested_name := left(requested_name, 23);
  if char_length(requested_name) < 3 then requested_name := 'uye_' || left(new.id::text, 8); end if;
  insert into public.profiles(user_id, username, display_name)
  values (new.id, requested_name || '_' || left(new.id::text, 4), coalesce(new.raw_user_meta_data ->> 'full_name', requested_name))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.user_activity enable row level security;

drop policy if exists "Public profiles are readable" on public.profiles;
create policy "Public profiles are readable" on public.profiles for select using (true);
drop policy if exists "Users create their own profile" on public.profiles;
create policy "Users create their own profile" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users update their own profile" on public.profiles;
create policy "Users update their own profile" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Published polls are readable" on public.polls;
create policy "Published polls are readable" on public.polls for select using (status = 'published' or created_by = (select auth.uid()));
drop policy if exists "Authenticated users create polls" on public.polls;
create policy "Authenticated users create polls" on public.polls for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "Poll owners update their polls" on public.polls;
create policy "Poll owners update their polls" on public.polls for update to authenticated using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
drop policy if exists "Poll owners delete their polls" on public.polls;
create policy "Poll owners delete their polls" on public.polls for delete to authenticated using (created_by = (select auth.uid()));

drop policy if exists "Options for published polls are readable" on public.poll_options;
create policy "Options for published polls are readable" on public.poll_options for select using (exists (select 1 from public.polls p where p.id = poll_id and p.status = 'published'));
drop policy if exists "Poll owners manage options" on public.poll_options;
create policy "Poll owners manage options" on public.poll_options for all to authenticated using (exists (select 1 from public.polls p where p.id = poll_id and p.created_by = (select auth.uid()))) with check (exists (select 1 from public.polls p where p.id = poll_id and p.created_by = (select auth.uid())));

drop policy if exists "Users can read only their own votes" on public.votes;
create policy "Users can read only their own votes" on public.votes for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users vote once on published polls" on public.votes;
create policy "Users vote once on published polls" on public.votes for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.polls p where p.id = poll_id and p.status = 'published')
);

 drop policy if exists "Visible comments are readable" on public.comments;
create policy "Visible comments are readable" on public.comments for select using (moderation_status = 'visible' or user_id = (select auth.uid()));
drop policy if exists "Users add visible comments to published polls" on public.comments;
create policy "Users add visible comments to published polls" on public.comments for insert to authenticated with check (
  user_id = (select auth.uid()) and moderation_status = 'visible' and exists (select 1 from public.polls p where p.id = poll_id and p.status = 'published')
);
drop policy if exists "Users edit their visible comments" on public.comments;
create policy "Users edit their visible comments" on public.comments for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and moderation_status = 'visible');
drop policy if exists "Users delete their own comments" on public.comments;
create policy "Users delete their own comments" on public.comments for delete to authenticated using (user_id = (select auth.uid()));

 drop policy if exists "Users read their own activity" on public.user_activity;
create policy "Users read their own activity" on public.user_activity for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Users record their own activity" on public.user_activity;
create policy "Users record their own activity" on public.user_activity for insert to authenticated with check (user_id = (select auth.uid()));

create or replace function public.get_poll_results()
returns table (poll_id uuid, option_id uuid, vote_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select v.poll_id, v.option_id, count(*)::bigint
  from public.votes v
  join public.polls p on p.id = v.poll_id
  where p.status = 'published'
  group by v.poll_id, v.option_id;
$$;
revoke all on function public.get_poll_results() from public;
grant execute on function public.get_poll_results() to anon, authenticated;

create or replace function public.get_leaderboard()
returns table (username text, display_name text, points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.username, pr.display_name, count(ua.id)::bigint as points
  from public.profiles pr
  join public.user_activity ua on ua.user_id = pr.user_id
  group by pr.user_id, pr.username, pr.display_name
  order by points desc, pr.username asc
  limit 10;
$$;
revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.polls, public.poll_options, public.profiles, public.comments to anon, authenticated;
grant insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.polls, public.poll_options to authenticated;
grant select, insert on public.votes to authenticated;
grant select, insert, update, delete on public.comments to authenticated;
grant select, insert on public.user_activity to authenticated;

insert into public.polls (question, description, category, featured, status) values
  ('Yapay zekâ ödevlerde yardımcı mı, yoksa öğrenmenin önünde bir kestirme mi?', 'Sence okulda üretken yapay zekânın yeri nasıl olmalı?', 'technology', true, 'published'),
  ('Bir oyunu tekrar tekrar açtıran şey sence ne?', 'Bir sonraki oyununu seçerken neye bakarsın?', 'gaming', false, 'published'),
  ('Uzay araştırmalarında öncelik insanlı görevler mi, robotlar mı olmalı?', 'Kaynaklar sınırlıyken hangisi daha çok şey kazandırır?', 'science', false, 'published'),
  ('Gündemi takip etmek için sosyal medya tek başına yeterli mi?', 'Bilgiye ulaşma alışkanlığımız değişiyor.', 'current-affairs', false, 'published'),
  ('İyi bir şehirde en önce ne olmalı?', 'Şehrin yaşam kalitesini belirleyen en önemli şey sence hangisi?', 'society', false, 'published'),
  ('Bir beceriyi öğrenirken en etkili yöntem hangisi?', 'Kendi deneyiminde hangisi daha çok işe yarıyor?', 'education', false, 'published'),
  ('Sporda başarıyı en çok ne belirler?', 'Bir takımın sezonunu sence ne değiştirir?', 'sports', false, 'published'),
  ('Bir filmde açık uçlu final mi, net bir son mu tercih edersin?', 'Film bittikten sonra düşünmeye devam etmek mi, her şeyin yerine oturması mı?', 'entertainment', false, 'published'),
  ('İyi bir hayatı daha çok huzur mu, heyecan mı tanımlar?', 'İkisi arasında seçim yapmak zorunda olsaydın?', 'philosophy', false, 'published'),
  ('Sabah erken başlamak mı, geç başlayıp akşam uzatmak mı?', 'Gün içinde enerjin en çok hangi saatlerde?', 'everyday-life', false, 'published')
on conflict do nothing;

with seed(question, options) as (
  values
  ('Yapay zekâ ödevlerde yardımcı mı, yoksa öğrenmenin önünde bir kestirme mi?', array['Doğru kullanılırsa güçlü bir yardımcı','Öğrenme sürecini zayıflatıyor','Derse ve kullanım amacına bağlı']::text[]),
  ('Bir oyunu tekrar tekrar açtıran şey sence ne?', array['İyi yazılmış bir hikâye','Akıcı ve derin oynanış','Birlikte oynadığım insanlar']::text[]),
  ('Uzay araştırmalarında öncelik insanlı görevler mi, robotlar mı olmalı?', array['İnsanlı görevler','Robotik keşif araçları','İkisi birlikte ilerlemeli']::text[]),
  ('Gündemi takip etmek için sosyal medya tek başına yeterli mi?', array['Evet, doğru hesapları izlemek yeterli','Hayır, farklı kaynakları karşılaştırmak gerekir','Konuya göre değişir']::text[]),
  ('İyi bir şehirde en önce ne olmalı?', array['Güvenilir toplu taşıma','Yeşil ve kamusal alanlar','Kültür ve komşuluk hayatı']::text[]),
  ('Bir beceriyi öğrenirken en etkili yöntem hangisi?', array['Yaparak ve deneyerek','Okuyup izleyerek','Birinden geri bildirim alarak']::text[]),
  ('Sporda başarıyı en çok ne belirler?', array['Oyuncu kalitesi','Takım uyumu','Doğru teknik ekip']::text[]),
  ('Bir filmde açık uçlu final mi, net bir son mu tercih edersin?', array['Yorumlamaya açık final','Net ve tamamlanmış final','Hikâye hangisini gerektiriyorsa']::text[]),
  ('İyi bir hayatı daha çok huzur mu, heyecan mı tanımlar?', array['Huzur ve istikrar','Heyecan ve yenilik','İkisi arasında denge']::text[]),
  ('Sabah erken başlamak mı, geç başlayıp akşam uzatmak mı?', array['Erken başlamak','Geç başlayıp akşam çalışmak','Sabit saat değil, esneklik']::text[])
)
insert into public.poll_options (poll_id, label, position)
select p.id, option.label, option.position::smallint
from seed s
join public.polls p on p.question = s.question
cross join lateral unnest(s.options) with ordinality as option(label, position)
on conflict (poll_id, position) do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes') then
    alter publication supabase_realtime add table public.votes;
  end if;
end $$;


create or replace function public.create_poll(p_question text, p_description text, p_category text, p_options text[])
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_poll_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if char_length(trim(p_question)) not between 12 and 240 then raise exception 'Question must be 12 to 240 characters'; end if;
  if p_category not in ('technology','gaming','science','current-affairs','society','education','sports','entertainment','philosophy','everyday-life') then raise exception 'Unknown poll category'; end if;
  if p_options is null or array_length(p_options, 1) not between 2 and 4 then raise exception 'Polls need 2 to 4 options'; end if;
  if exists (select 1 from unnest(p_options) as item where char_length(trim(item)) not between 1 and 120) then raise exception 'Options must be 1 to 120 characters'; end if;
  if (select count(distinct lower(trim(item))) from unnest(p_options) as item) <> array_length(p_options, 1) then raise exception 'Options must be unique'; end if;
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
