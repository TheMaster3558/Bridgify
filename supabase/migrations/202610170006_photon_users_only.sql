-- Photon Pro identity is the Photon Users list. A Bridgify invitation is not
-- required to connect iMessage or activate a shared-line project.
create or replace function public.onboarding_command(p_project uuid,p_expected integer,p_section text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; b chat_bindings; prior command_receipts; fingerprint text; result jsonb; next_status text;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_project is null or p_section not in ('people','lifecycle') or p_payload is null or jsonb_typeof(p_payload)<>'object'
    or (p_section='people' and p_payload->>'channel' is distinct from 'photon_shared')
    or (p_section='lifecycle' and coalesce(p_payload->>'status','') not in ('active','review_only')) then
  return onboarding_command_before_photon_pro(p_project,p_expected,p_section,p_payload,p_key);
 end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into p from projects where id=p_project for update;
 if not found or not is_owner(p.organization_id) then raise insufficient_privilege; end if;
 if p_section='lifecycle' and p.people->>'channel' is distinct from 'photon_shared' then
  return onboarding_command_before_photon_pro(p_project,p_expected,p_section,p_payload,p_key);
 end if;
 fingerprint:=md5(p_project::text||coalesce(p_expected::text,'')||p_section||p_payload::text);
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused with different input' using errcode='40001'; end if;
  return prior.result;
 end if;
 if p.version is distinct from p_expected then raise exception 'Project changed; refresh before retrying' using errcode='40001'; end if;
 if exists(select 1 from chat_bindings where project_id=p.id and test_state='sending') then raise exception 'Wait for the introduction to finish sending before changing setup'; end if;
 if p_section='people' then
  if p.activation_cutoff is not null or p.status in ('completed','archived') then raise exception 'Activated or closed setup is immutable. Material changes require an approved amendment; history is retained.'; end if;
  if length(trim(coalesce(p_payload->>'photon_user_id','')))=0 or length(trim(coalesce(p_payload->>'client_sender_id','')))=0
     or length(trim(coalesce(p_payload->>'instance_id','')))=0
     or p_payload->>'chat_guid' is distinct from 'any;-;'||(p_payload->>'client_sender_id') then
   raise exception 'Choose the client from your Photon users';
  end if;
  delete from chat_bindings where project_id=p.id;
  update projects set people=jsonb_build_object(
    'channel','photon_shared',
    'photon_user_id',p_payload->>'photon_user_id',
    'client_name',p_payload->>'client_name',
    'client_email',p_payload->>'client_email',
    'client_sender_id',p_payload->>'client_sender_id',
    'agent_number',p_payload->>'agent_number',
    'instance_id',p_payload->>'instance_id',
    'chat_guid',p_payload->>'chat_guid',
    'client_user_id',(select user_id from project_members where project_id=p.id limit 1),
    'owner_user_id',auth.uid()
   ),setup_step=greatest(setup_step,4) where id=p.id;
 else
  next_status:=p_payload->>'status';
  if length(trim(coalesce(p_payload->>'reason','')))<3 then raise exception 'A lifecycle reason is required'; end if;
  if p.status in ('completed','archived') then raise exception 'Closed projects cannot accept more work'; end if;
  if p.scope_version=0 or p.policy_version=0 or p.people is null then raise exception 'Confirm scope, participants and automation first'; end if;
  select * into b from chat_bindings where project_id=p.id;
  if b.project_id is null or b.verified_at is null or b.test_state<>'sent' or b.disclosed_message_guid is null or b.hold_reason is not null then raise exception 'Send the assistant introduction to the client over iMessage first'; end if;
  if p.activation_cutoff is null and (p_payload->>'disclosed')::boolean is distinct from true then raise exception 'Confirm all participants agreed to assistant processing'; end if;
  if next_status='active' and p.policy->>'mode'<>'enabled' then raise exception 'Choose review-only for this policy'; end if;
  update projects set activation_cutoff=clock_timestamp(),disclosure_at=coalesce(disclosure_at,now()),status=next_status where id=p.id;
 end if;
 update projects set version=version+1,updated_at=now() where id=p.id returning * into p;
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),p_section||case when p_section='lifecycle' then ':'||next_status else '' end,p.version,case when p_section='lifecycle' then jsonb_build_object('reason',p_payload->>'reason') else '{}'::jsonb end);
 result:=jsonb_build_object('project',to_jsonb(p));
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.onboarding_command(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.onboarding_command(uuid,integer,text,jsonb,text) to authenticated,service_role;
