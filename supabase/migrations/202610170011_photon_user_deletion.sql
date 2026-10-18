-- Reserve provider deletions before calling Photon, and block concurrent re-linking.
create table public.photon_user_deletions (
 instance_id text not null,
 user_id text not null,
 requested_by uuid not null references auth.users,
 phone_number text,
 state text not null default 'pending' check(state in ('pending','deleted')),
 updated_at timestamptz not null default now(),
 primary key(instance_id,user_id)
);
alter table public.photon_user_deletions enable row level security;
create policy own_photon_deletion_receipt on public.photon_user_deletions for select to authenticated using(requested_by=auth.uid());
grant select on public.photon_user_deletions to authenticated;
grant all on public.photon_user_deletions to service_role;

create function public.begin_photon_user_deletion(p_project uuid,p_instance text,p_user text,p_phone text)
returns text language plpgsql security definer set search_path=public as $$
declare p projects; receipt photon_user_deletions;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into p from projects where id=p_project for update;
 if not found or not is_owner(p.organization_id) then raise insufficient_privilege; end if;
 if p.status<>'draft' or p.activation_cutoff is not null then raise exception 'Delete Photon users from an unfinished project setup' using errcode='22023'; end if;
 if length(coalesce(p_instance,'')) not between 1 and 200 or length(coalesce(p_user,'')) not between 1 and 200 or coalesce(p_phone,'') !~ '^\+[1-9][0-9]{6,14}$' then raise exception 'Invalid Photon user' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext('photon-user:'||p_instance||':'||p_user));
 -- Check every workspace without returning other owners' private project details.
 if exists(select 1 from projects where people->>'instance_id'=p_instance and (people->>'photon_user_id'=p_user or people->>'client_sender_id'=p_phone))
    or exists(select 1 from chat_bindings where instance_id=p_instance and chat_guid='any;-;'||p_phone) then
  raise exception 'This Photon user is linked to a project. Switch that project to another client or delete the project before deleting this user.' using errcode='22023';
 end if;
 select * into receipt from photon_user_deletions where instance_id=p_instance and user_id=p_user;
 if found then
  if receipt.requested_by<>auth.uid() then raise exception 'Deletion is already being handled by another owner. Refresh the Photon users list.' using errcode='22023'; end if;
  if receipt.state='pending' and receipt.phone_number is distinct from p_phone then raise exception 'The user details changed. Refresh before deleting.' using errcode='22023'; end if;
  return receipt.state;
 end if;
 insert into photon_user_deletions(instance_id,user_id,requested_by,phone_number) values(p_instance,p_user,auth.uid(),p_phone);
 return 'pending';
end $$;
revoke all on function public.begin_photon_user_deletion(uuid,text,text,text) from public,anon;
grant execute on function public.begin_photon_user_deletion(uuid,text,text,text) to authenticated;

alter function public.onboarding_command(uuid,integer,text,jsonb,text) rename to onboarding_command_before_user_deletion;
revoke all on function public.onboarding_command_before_user_deletion(uuid,integer,text,jsonb,text) from public,anon,authenticated;
create function public.onboarding_command(p_project uuid,p_expected integer,p_section text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects;
begin
 if p_section='people' and p_payload->>'channel'='photon_shared' then
  select * into p from projects where id=p_project for update;
  if auth.uid() is null or not found or not is_owner(p.organization_id) then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtext('photon-user:'||(p_payload->>'instance_id')||':'||(p_payload->>'photon_user_id')));
  if exists(select 1 from photon_user_deletions where instance_id=p_payload->>'instance_id' and user_id=p_payload->>'photon_user_id') then
   raise exception 'This Photon user is being deleted or has been deleted. Refresh the users list and choose another client.' using errcode='22023';
  end if;
 end if;
 return onboarding_command_before_user_deletion(p_project,p_expected,p_section,p_payload,p_key);
end $$;
revoke all on function public.onboarding_command(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.onboarding_command(uuid,integer,text,jsonb,text) to authenticated,service_role;
