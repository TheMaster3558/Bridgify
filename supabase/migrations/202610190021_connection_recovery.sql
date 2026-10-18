alter table public.chat_bindings add column introduction_attempted_at timestamptz;
-- Record the exact attempted body before any provider I/O.
create function public.begin_chat_test(p_project uuid,p_expected integer,p_participants jsonb,p_hash text,p_introduction text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if length(trim(coalesce(p_introduction,''))) not between 1 and 4000 then raise exception 'Write an introduction'; end if;
 result:=begin_chat_test(p_project,p_expected,p_participants,p_hash);
 update chat_bindings set introduction_text=trim(p_introduction),introduction_attempted_at=clock_timestamp() where project_id=p_project;
 return result;
end $$;
revoke all on function public.begin_chat_test(uuid,integer,jsonb,text,text) from public,anon;
grant execute on function public.begin_chat_test(uuid,integer,jsonb,text,text) to authenticated;
create function public.reset_chat_verification(p_project uuid,p_expected integer,p_confirmed boolean,p_reason text,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; b chat_bindings; prior command_receipts; fingerprint text; result jsonb;
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege; end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 fingerprint:=md5(jsonb_build_array(p_project,p_expected,p_confirmed,p_reason)::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused' using errcode='40001'; end if;return prior.result;end if;
 select * into p from projects where id=p_project for update;
 if p.version is distinct from p_expected then raise exception 'Project changed; refresh' using errcode='40001'; end if;
 if p.status not in ('draft','paused','review_only') then raise exception 'Pause the project before recovering its connection'; end if;
 select * into b from chat_bindings where project_id=p.id for update;
 if b.project_id is null then raise exception 'Save the client connection first'; end if;
 if b.test_state='sending' and coalesce(b.introduction_attempted_at,p.updated_at)>now()-interval '2 minutes' then raise exception 'The introduction may still be sending; wait before recovering it'; end if;
 if p_confirmed is distinct from true or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Check the conversation and explicitly confirm non-delivery with a reason'; end if;
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),'connection:retry_authorized',p.version,jsonb_build_object('previousBinding',to_jsonb(b),'reason',p_reason));
 update chat_bindings set test_state='pending',verified_at=null,webhook_verified_at=null,disclosed_message_guid=null,test_message_guid=null,hold_reason='Introduction must be sent and verified again' where project_id=p.id;
 update projects set version=version+1,updated_at=clock_timestamp() where id=p.id returning * into p;
 result:=jsonb_build_object('project',to_jsonb(p));insert into command_receipts values(auth.uid(),p_key,fingerprint,result);return result;
end $$;
revoke all on function public.reset_chat_verification(uuid,integer,boolean,text,text) from public,anon;
grant execute on function public.reset_chat_verification(uuid,integer,boolean,text,text) to authenticated;
create function public.confirm_chat_receipt(p_project uuid,p_expected integer,p_actor uuid,p_guid text,p_text text,p_at timestamptz,p_instance text,p_chat text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects;b chat_bindings;
begin
 select * into p from projects where id=p_project for update;
 if p.id is null or not exists(select 1 from organization_members where organization_id=p.organization_id and user_id=p_actor and role='owner') then raise insufficient_privilege; end if;
 if p.version is distinct from p_expected then raise exception 'Project changed; refresh' using errcode='40001';end if;
 if p.status not in ('draft','paused','review_only') then raise exception 'Pause before verifying the connection';end if;
 select * into b from chat_bindings where project_id=p.id for update;
 if b.project_id is null or b.introduction_text is distinct from p_text or b.instance_id is distinct from p_instance or b.chat_guid is distinct from p_chat
  or p_instance is distinct from p.people->>'instance_id' or p_chat is distinct from p.people->>'chat_guid'
  or length(coalesce(p_guid,'')) not between 1 and 256 or p_at is null then raise exception 'Receipt does not match this connection';end if;
 if b.introduction_attempted_at is not null then
  if p_at<b.introduction_attempted_at-interval '3 seconds' or p_at>b.introduction_attempted_at+interval '5 minutes' then raise exception 'Receipt does not match the introduction attempt';end if;
 elsif p_guid is distinct from b.test_message_guid and p_guid is distinct from b.disclosed_message_guid then raise exception 'Legacy send has no matching receipt; review non-delivery before retrying';end if;
 update chat_bindings set test_state='sent',test_message_guid=p_guid,disclosed_message_guid=p_guid,verified_at=clock_timestamp(),hold_reason=null where project_id=p.id;
 update projects set disclosure_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() where id=p.id;
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,p_actor,'connection:receipt_verified',p.version+1,jsonb_build_object('providerMessageId',p_guid));
end $$;
revoke all on function public.confirm_chat_receipt(uuid,integer,uuid,text,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.confirm_chat_receipt(uuid,integer,uuid,text,text,timestamptz,text,text) to service_role;
notify pgrst,'reload schema';

-- Resuming must not turn work queued before the fresh cutoff into new promises.
alter function public.onboarding_command(uuid,integer,text,jsonb,text) rename to onboarding_command_before_connection_recovery;
revoke all on function public.onboarding_command_before_connection_recovery(uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
create function public.onboarding_command(p_project uuid,p_expected integer,p_section text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; result jsonb; j record; o record; cutoff timestamptz;
begin
 if p_section='lifecycle' and p_payload->>'status' in ('active','review_only') then
  if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege;end if;
  select * into p from projects where id=p_project for update;
  if p.status='paused' and (p_payload->>'disclosed')::boolean is distinct from true then raise exception 'Confirm client identity and consent before resuming';end if;
 end if;
 result:=onboarding_command_before_connection_recovery(p_project,p_expected,p_section,p_payload,p_key);
 if p.status='paused' and p_payload->>'status' in ('active','review_only') then
  cutoff:=(result#>>'{project,activation_cutoff}')::timestamptz;
  for j in select a.id from automation_jobs a join automation_messages m on m.id=a.message_id
   where a.project_id=p.id and a.state in ('queued','running') and m.occurred_at<cutoff for update of a loop
   update automation_jobs set review_reason='policy_denied' where id=j.id;
   perform ensure_failed_request_review(j.id,'Queued before resume; requires explicit owner review');
   update automation_jobs set state='done',lease_token=null,lease_until=null where id=j.id;
  end loop;
  for o in select * from automation_outbox where project_id=p.id and state='queued' and created_at<cutoff for update loop
   update automation_outbox set state='cancelled',updated_at=clock_timestamp() where id=o.id;
   insert into owner_decisions(project_id,decision_code,request_code,reason,title,source_text,explanation,history)
    values(p.id,'DEC-HELD-'||left(replace(o.id::text,'-',''),12),'REPLY-'||left(replace(o.id::text,'-',''),12),'delivery_unknown','Review reply held during pause',o.text,'This queued reply was not submitted. Inspect the conversation and decide whether it is still appropriate.','["Held on project resume"]') on conflict(project_id,decision_code) do nothing;
  end loop;
 end if;
 return result;
end $$;
revoke all on function public.onboarding_command(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.onboarding_command(uuid,integer,text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
