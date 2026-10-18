-- Historical invitations/accounts remain as private audit data, never web access.
update public.project_invitations set revoked_at=now() where revoked_at is null;
update public.projects set people=people-'client_user_id'-'approver_user_id' where people is not null;
revoke all on function public.accept_invitation(text),public.shared_proposal(uuid,integer) from public,anon,authenticated;

alter function public.onboarding_command(uuid,integer,text,jsonb,text) rename to onboarding_command_before_owner_only;
create function public.onboarding_command(p_project uuid,p_expected integer,p_section text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if p_section='invite' then raise exception 'Clients communicate only through iMessage'; end if;
  if p_section='people' and p_payload->>'channel' is distinct from 'photon_shared' then
    raise exception 'Choose a client from Photon Users';
  end if;
  result:=onboarding_command_before_owner_only(p_project,p_expected,p_section,p_payload,p_key);
  if p_section='people' then
    update projects set people=people-'client_user_id'-'approver_user_id' where id=p_project;
    result:=jsonb_set(result,'{project,people}',(select people from projects where id=p_project));
  end if;
  return result;
end $$;
-- Old renamed commands must not remain callable as alternate public RPCs.
do $$ declare f record; begin
  for f in select oid::regprocedure signature from pg_proc where pronamespace='public'::regnamespace
    and proname like 'onboarding_command%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
grant execute on function public.onboarding_command(uuid,integer,text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
