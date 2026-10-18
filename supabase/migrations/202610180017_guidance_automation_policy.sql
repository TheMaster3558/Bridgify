-- New policies can use plain-language guidance across the confirmed scope.
-- Previously saved operation/target lists retain their existing behavior.
create function public.validate_guidance_policy(pol jsonb) returns void
language plpgsql set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(pol) is distinct from 'object' or not (pol ?& array[
  'mode','allowance_mode','allowance','operations','targets','exclusions','max_open_tasks','notifications','permission_mode','acceptance_guidance'])
  or exists(select 1 from jsonb_each(pol) where value='null'::jsonb)
  or pol->>'permission_mode' is distinct from 'guidance'
  or pol->>'mode' not in ('enabled','review_only') or pol->>'allowance_mode' not in ('per_request','manual_rounds')
  or jsonb_typeof(pol->'acceptance_guidance') is distinct from 'string'
  or length(pol->>'acceptance_guidance')>4000
  or (pol->>'allowance')::int not between 0 and 10000 or (pol->>'max_open_tasks')::int not between 1 and 10
  or pol->>'notifications'<>'dashboard' or length(trim(pol->>'exclusions')) not between 1 and 4000
  then raise exception 'Invalid automation guidance or limits' using errcode='22023'; end if;
 if jsonb_typeof(pol->'operations') is distinct from 'array' or jsonb_array_length(pol->'operations')>2
  or exists(select 1 from jsonb_array_elements_text(pol->'operations') op where op not in ('replace_text','change_color'))
  or jsonb_typeof(pol->'targets') is distinct from 'array' or jsonb_array_length(pol->'targets')>30
  or exists(select 1 from jsonb_array_elements(pol->'targets') target where jsonb_typeof(target)<>'string' or length(trim(target#>>'{}')) not between 1 and 200)
  then raise exception 'Invalid optional page or element limits' using errcode='22023'; end if;
 if pol->>'mode'='enabled' and (pol->>'allowance_mode'<>'per_request' or (pol->>'allowance')::int<1
  or length(trim(pol->>'acceptance_guidance'))=0) then
  raise exception 'Automatic acceptance requires included individual requests and acceptance guidance' using errcode='22023';
 end if;
 if pol ? 'replies' and (jsonb_typeof(pol->'replies') is distinct from 'object'
  or exists(select 1 from jsonb_each(pol->'replies') where key not in ('status_questions','clarifications','review_acknowledgments','progress_updates') or jsonb_typeof(value)<>'boolean')) then
  raise exception 'Invalid reply preferences' using errcode='22023';
 end if;
end $$;
revoke all on function public.validate_guidance_policy(jsonb) from public,anon,authenticated;

alter function public.onboarding_command(uuid,integer,text,jsonb,text) rename to onboarding_command_before_guidance_policy;
revoke all on function public.onboarding_command_before_guidance_policy(uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
create function public.onboarding_command(p_project uuid,p_expected integer,p_section text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; prior command_receipts; fingerprint text; result jsonb;
begin
 if p_section is distinct from 'policy' or p_payload->>'permission_mode' is distinct from 'guidance' then
  return onboarding_command_before_guidance_policy(p_project,p_expected,p_section,p_payload,p_key);
 end if;
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into p from projects where id=p_project for update;
 if not found or not is_owner(p.organization_id) then raise insufficient_privilege; end if;
 fingerprint:=md5(p_project::text||coalesce(p_expected::text,'')||p_section||p_payload::text);
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused with different input' using errcode='40001'; end if;
  return prior.result;
 end if;
 if p.version is distinct from p_expected then raise exception 'Project changed; refresh before retrying' using errcode='40001'; end if;
 if p.activation_cutoff is not null or p.status in ('completed','archived') then raise exception 'Use an explicit policy amendment after activation'; end if;
 if exists(select 1 from chat_bindings where project_id=p.id and test_state='sending') then raise exception 'Wait for the introduction to finish sending before changing setup'; end if;
 if p.scope_version<1 then raise exception 'Confirm the agreement before saving automation guidance'; end if;
 perform validate_guidance_policy(p_payload);
 if p_payload->>'mode'='enabled' and exists(select 1 from scope_versions s,jsonb_array_elements(s.terms) t
  where s.project_id=p.id and s.version=p.scope_version and t->>'kind'='revision'
  and ((t->>'text')||' '||coalesce(t->>'quote','')) ~* '\mrounds?\M') then raise exception 'Agreement describes revision rounds; use review-only mode'; end if;
 select coalesce(max(version),0)+1 into p.policy_version from policy_versions where project_id=p.id;
 insert into policy_versions values(p.id,p.policy_version,p_payload,auth.uid(),now());
 update projects set policy=p_payload,policy_version=p.policy_version,setup_step=5,version=version+1,updated_at=now() where id=p.id returning * into p;
 insert into audit_events(project_id,actor_id,action,version) values(p.id,auth.uid(),'policy',p.version);
 result:=jsonb_build_object('project',to_jsonb(p));
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.onboarding_command(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.onboarding_command(uuid,integer,text,jsonb,text) to authenticated,service_role;

-- Keep every existing owner-command guard, receipt, scope/accounting check and
-- audit. Replace only its policy-shape validation with a guidance-aware branch.
do $$
declare definition text; first_pos int; last_pos int; old_validation text;
begin
 definition:=pg_get_functiondef('public.automation_owner_command(uuid,text,jsonb,text)'::regprocedure);
 first_pos:=strpos(definition,'  if not (pol ?& array[');
 last_pos:=strpos(definition,'  if pol ? ''replies''');
 if first_pos=0 or last_pos<=first_pos then raise exception 'Owner policy validator version does not match'; end if;
 old_validation:=substr(definition,first_pos,last_pos-first_pos);
 definition:=substr(definition,1,first_pos-1)||
  '  if pol->>''permission_mode''=''guidance'' then perform validate_guidance_policy(pol); else'||E'\n'||
  old_validation||'  end if;'||E'\n'||substr(definition,last_pos);
 definition:=replace(definition,'target_id=coalesce(r.intent->>''targetId'',target_id)',
  'target_id=coalesce(r.intent->>''targetId'',r.intent#>>''{payload,targetDescription}'',target_id)');
 execute definition;
end $$;

-- Owner-approved general requests retain the same actionable payload as an
-- automatically accepted request, including the client's descriptive target.
do $$
declare definition text; old_values text;
begin
 definition:=pg_get_functiondef('public.resolve_automation_review_before_changes(uuid,text,text,text,text,text)'::regprocedure);
 old_values:='r.intent->>''operation'',r.intent->>''targetId'',coalesce(r.intent#>>''{payload,replacementText}'',r.intent#>>''{payload,color}'')';
 if strpos(definition,old_values)=0 then raise exception 'Owner review payload version does not match'; end if;
 definition:=replace(definition,old_values,
  'r.intent->>''operation'',coalesce(r.intent->>''targetId'',r.intent#>>''{payload,targetDescription}''),case when r.intent->>''operation''=''project_change'' then r.intent#>>''{payload,instructions}'' else coalesce(r.intent#>>''{payload,replacementText}'',r.intent#>>''{payload,color}'') end');
 execute definition;
end $$;
notify pgrst, 'reload schema';
