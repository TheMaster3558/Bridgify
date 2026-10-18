-- Manual approval needs no automatic targets. Preserve every other command guard.
create or replace function public.onboarding_command_v1(p_project uuid, p_expected integer, p_section text, p_payload jsonb, p_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; oid uuid; result jsonb; fingerprint text; prior command_receipts; d documents; term jsonb; token text; binding chat_bindings; next_status text;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_section is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'A setup command object is required'; end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 fingerprint := md5(coalesce(p_project::text,'')||coalesce(p_expected::text,'')||p_section||p_payload::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
   if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused with different input' using errcode='40001'; end if;
   return prior.result;
 end if;
 if p_project is null then
  if p_section<>'basics' then raise exception 'Create project basics first'; end if;
  select organization_id into oid from organization_members where user_id=auth.uid() and role='owner';
  if oid is null then raise insufficient_privilege; end if;
  insert into projects(organization_id,owner_id,name,client_name,original_amount_cents,currency,timezone,agreed_due_date)
  values(oid,auth.uid(),p_payload->>'name',p_payload->>'client_name',(p_payload->>'original_amount_cents')::bigint,p_payload->>'currency',p_payload->>'timezone',(p_payload->>'agreed_due_date')::date) returning * into p;
 else
  select * into p from projects where id=p_project for update;
  if not found or not public.is_owner(p.organization_id) then raise insufficient_privilege; end if;
  if p.version is distinct from p_expected then raise exception 'Project changed; refresh before retrying' using errcode='40001'; end if;
  if exists(select 1 from chat_bindings where project_id=p.id and test_state='sending') then raise exception 'Wait for the connection test to finish before changing setup'; end if;
  if p_section in ('basics','scope','people','policy','document','invite') and (p.activation_cutoff is not null or p.status in ('completed','archived')) then raise exception 'Activated or closed setup is immutable. Material changes require an approved amendment; history is retained.'; end if;
  if p_section='basics' then
   update projects set name=p_payload->>'name',client_name=p_payload->>'client_name',original_amount_cents=(p_payload->>'original_amount_cents')::bigint,currency=p_payload->>'currency',timezone=p_payload->>'timezone',agreed_due_date=(p_payload->>'agreed_due_date')::date where id=p.id;
  elsif p_section='document' then
   if p_payload->>'kind' not in ('text','pdf') then raise exception 'Unsupported agreement type'; end if;
   if p_payload->>'kind'='text' and length(trim(coalesce(p_payload->>'text',''))) not between 1 and 30000 then raise exception 'Agreement must contain 1–30,000 characters'; end if;
   if p_payload->>'kind'='pdf' and (p_payload->>'storage_path' not like p.id::text||'/%' or p_payload->>'storage_path' is null) then raise exception 'Invalid private document path'; end if;
   insert into documents(project_id,kind,original_text,storage_path) values(p.id,p_payload->>'kind',p_payload->>'text',p_payload->>'storage_path') returning * into d;
   insert into jobs(document_id) values(d.id);
   -- A replacement agreement invalidates the draft baseline, without deleting earlier evidence.
   update projects set scope_version=0,policy_version=0,policy=null,setup_step=2 where id=p.id;
  elsif p_section='scope' then
   select * into d from documents where id=(p_payload->>'document_id')::uuid and project_id=p.id and status='ready';
   if not found or (p_payload->>'reviewed_all_terms')::boolean is distinct from true then raise exception 'Review the complete extracted agreement first'; end if;
   if d.id<>(select id from documents where project_id=p.id order by created_at desc,id desc limit 1) then raise exception 'Confirm the most recent agreement'; end if;
   if jsonb_typeof(p_payload->'terms')<>'array' or jsonb_array_length(p_payload->'terms') not between 1 and 100 then raise exception 'Confirm 1–100 terms'; end if;
   if not exists(select 1 from jsonb_array_elements(p_payload->'terms') t where t->>'kind'='inclusion') then raise exception 'At least one included scope item is required'; end if;
   for term in select * from jsonb_array_elements(p_payload->'terms') loop
    if term->>'kind' not in ('inclusion','exclusion','revision','date','responsibility') or length(trim(coalesce(term->>'text',''))) not between 1 and 2000 or length(coalesce(term->>'quote',''))=0 then raise exception 'Invalid confirmed term'; end if;
    if not exists(select 1 from document_spans s where s.id=(term->>'span_id')::uuid and s.document_id=d.id and position(term->>'quote' in s.text)>0) then raise exception 'Each term needs a valid source quotation'; end if;
   end loop;
   insert into scope_versions(project_id,version,document_id,terms,confirmed_by) values(p.id,(select coalesce(max(version),0)+1 from scope_versions where project_id=p.id),d.id,p_payload->'terms',auth.uid()) returning version into p.scope_version;
   update projects set scope_version=p.scope_version,policy_version=0,policy=null,setup_step=3 where id=p.id;
  elsif p_section='invite' then
   if length(p_payload->>'email') not between 3 and 254 or p_payload->>'email' not like '%@%' then raise exception 'Valid email required'; end if;
   if lower(p_payload->>'email')=(select lower(email) from auth.users where id=auth.uid()) then raise exception 'Invite a separate client identity'; end if;
   if p_payload->>'proposal_id' is not null and not exists(select 1 from proposal_revisions where proposal_id=(p_payload->>'proposal_id')::uuid and revision=(p_payload->>'revision')::integer and project_id=p.id) then raise exception 'Proposal is unavailable'; end if;
   update project_invitations set revoked_at=now() where project_id=p.id and revoked_at is null;
   delete from project_members where project_id=p.id;
   delete from chat_bindings where project_id=p.id;
   update projects set people=null where id=p.id;
   token := replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   insert into project_invitations(project_id,email,token_hash,proposal_id,revision) values(p.id,lower(p_payload->>'email'),encode(sha256(convert_to(token,'UTF8')),'hex'),(p_payload->>'proposal_id')::uuid,(p_payload->>'revision')::integer);
  elsif p_section='people' then
   if (p_payload->>'identities_confirmed')::boolean is distinct from true or length(coalesce(p_payload->>'instance_id',''))=0 or length(coalesce(p_payload->>'chat_guid',''))=0 then raise exception 'Confirm exact group and identities'; end if;
   if (select count(distinct v) from (values(p_payload->>'owner_sender_id'),(p_payload->>'client_sender_id'),(p_payload->>'bot_sender_id')) ids(v) where length(v)>0)<>3 then raise exception 'Three distinct sender identities are required'; end if;
   if not exists(select 1 from project_members where project_id=p.id and requester and approver) then raise exception 'Client must accept the invitation before identity mapping'; end if;
   delete from chat_bindings where project_id=p.id;
   update projects set people=p_payload||jsonb_build_object('client_user_id',(select user_id from project_members where project_id=p.id limit 1),'owner_user_id',auth.uid()),setup_step=4 where id=p.id;
  elsif p_section='policy' then
   if not (p_payload ?& array['mode','allowance_mode','allowance','operations','targets','exclusions','max_open_tasks','notifications']) or exists(select 1 from jsonb_each(p_payload) where value='null'::jsonb) then raise exception 'Complete automation settings are required'; end if;
   if p_payload->>'mode' not in ('enabled','review_only') or p_payload->>'allowance_mode' not in ('per_request','manual_rounds') or (p_payload->>'allowance')::integer not between 0 and 10000 or (p_payload->>'max_open_tasks')::integer not between 1 and 10 or p_payload->>'notifications'<>'dashboard' then raise exception 'Invalid automation settings'; end if;
   if jsonb_typeof(p_payload->'targets') is distinct from 'array' or jsonb_array_length(p_payload->'targets')>30 or (p_payload->>'mode'='enabled' and jsonb_array_length(p_payload->'targets')=0) or length(trim(p_payload->>'exclusions'))=0 then raise exception 'Choose pages or elements for automatic acceptance; manual approval may leave them blank'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_payload->'operations') op where op not in ('replace_text','change_color')) then raise exception 'Unsupported operation'; end if;
   if p_payload->>'mode'='enabled' and (p_payload->>'allowance_mode'<>'per_request' or (p_payload->>'allowance')::integer<1 or jsonb_array_length(p_payload->'operations')<1) then raise exception 'Automatic work requires a per-request allowance'; end if;
   if p_payload->>'mode'='enabled' and exists(select 1 from scope_versions s, jsonb_array_elements(s.terms) t where s.project_id=p.id and s.version=p.scope_version and t->>'kind'='revision' and ((t->>'text')||' '||(t->>'quote')) ~* '\mrounds?\M') then raise exception 'Agreement describes revision rounds; use review-only mode'; end if;
   select coalesce(max(version),0)+1 into p.policy_version from policy_versions where project_id=p.id;
   insert into policy_versions values(p.id,p.policy_version,p_payload,auth.uid(),now());
   update projects set policy=p_payload,policy_version=p.policy_version,setup_step=5 where id=p.id;
  elsif p_section='lifecycle' then
   next_status := p_payload->>'status';
   if length(trim(coalesce(p_payload->>'reason','')))<3 then raise exception 'A lifecycle reason is required'; end if;
   if next_status not in ('active','paused','review_only','completed','archived') then raise exception 'Invalid lifecycle state'; end if;
   if p.status='archived' or (p.status='completed' and next_status<>'archived') then raise exception 'Closed projects cannot accept more work'; end if;
   if p.status='draft' and next_status not in ('active','review_only','archived') then raise exception 'Finish setup before pausing or completing'; end if;
   if next_status in ('active','review_only') then
    select * into binding from chat_bindings where project_id=p.id;
    if p.scope_version=0 or p.policy_version=0 or p.people is null then raise exception 'Confirm scope, participants and automation first'; end if;
    if not exists(select 1 from project_members where project_id=p.id and requester and approver) then raise exception 'Invited client must authenticate and accept'; end if;
    if binding.verified_at is null or binding.test_state<>'sent' or binding.webhook_verified_at is null or binding.disclosed_message_guid is null or binding.hold_reason is not null then raise exception 'A verified group, test send, verified webhook and assistant disclosure are required'; end if;
    if p.activation_cutoff is null and (p_payload->>'disclosed')::boolean is distinct from true then raise exception 'Confirm all participants agreed to assistant processing'; end if;
    if next_status='active' and p.policy->>'mode'<>'enabled' then raise exception 'Choose review-only for this policy'; end if;
    update projects set activation_cutoff=clock_timestamp(),disclosure_at=coalesce(disclosure_at,now()) where id=p.id;
   end if;
   update projects set status=next_status where id=p.id;
  else raise exception 'Unsupported setup command'; end if;
  update projects set version=version+1,updated_at=now() where id=p.id returning * into p;
 end if;
 if not exists(select 1 from pg_timezone_names where name=p.timezone) then raise exception 'Invalid project timezone'; end if;
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),p_section||case when p_section='lifecycle' then ':'||next_status else '' end,p.version,case when p_section='lifecycle' then jsonb_build_object('reason',p_payload->>'reason') else '{}'::jsonb end);
 result := jsonb_build_object('project',to_jsonb(p),'documentId',d.id,'invitationToken',token);
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.onboarding_command_v1(uuid,integer,text,jsonb,text) from public,anon,authenticated;
