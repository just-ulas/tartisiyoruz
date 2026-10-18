-- Public read, owner-only write storage for profile photos and banners.
insert into storage.buckets (id, name, public)
values ('profile-media', 'profile-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public profile media is readable" on storage.objects;
create policy "Public profile media is readable"
on storage.objects for select
using (bucket_id = 'profile-media');

drop policy if exists "Users upload their profile media" on storage.objects;
create policy "Users upload their profile media"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users update their profile media" on storage.objects;
create policy "Users update their profile media"
on storage.objects for update to authenticated
using (bucket_id = 'profile-media' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'profile-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Users delete their profile media" on storage.objects;
create policy "Users delete their profile media"
on storage.objects for delete to authenticated
using (bucket_id = 'profile-media' and owner_id = (select auth.uid())::text);
