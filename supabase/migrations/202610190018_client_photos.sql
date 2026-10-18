-- Client profile photos, shared by every project in a workspace with the same client name.
create table public.client_photos (
  organization_id uuid not null references public.organizations on delete cascade,
  client_key text not null check (length(client_key) between 1 and 120 and client_key = lower(btrim(client_key))),
  storage_path text not null unique,
  updated_at timestamptz not null default now(),
  primary key (organization_id, client_key),
  check (split_part(storage_path, '/', 1) = organization_id::text)
);
alter table public.client_photos enable row level security;
create policy owner_read on public.client_photos for select to authenticated using (public.is_owner(organization_id));
create policy owner_insert on public.client_photos for insert to authenticated with check (public.is_owner(organization_id));
create policy owner_update on public.client_photos for update to authenticated using (public.is_owner(organization_id)) with check (public.is_owner(organization_id));
create policy owner_delete on public.client_photos for delete to authenticated using (public.is_owner(organization_id));
grant select, insert, update, delete on public.client_photos to authenticated;
grant all on public.client_photos to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-photos', 'client-photos', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Objects live under "<organization id>/"; only that workspace's owner can touch them.
create policy client_photo_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'client-photos' and case when split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' then public.is_owner(split_part(name, '/', 1)::uuid) else false end
);
create policy client_photo_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'client-photos' and case when split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' then public.is_owner(split_part(name, '/', 1)::uuid) else false end
);
create policy client_photo_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'client-photos' and case when split_part(name, '/', 1) ~ '^[0-9a-f-]{36}$' then public.is_owner(split_part(name, '/', 1)::uuid) else false end
);
