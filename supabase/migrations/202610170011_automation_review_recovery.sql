alter table public.owner_decisions add column source_job_id uuid references public.automation_jobs;
alter table public.owner_decisions add column deleted_at timestamptz;
update public.owner_decisions d set source_job_id=r.job_id from public.automation_requests r where d.automation_request_id=r.id;

-- A processing failure is still a real, verified client request. Preserve its
-- exact source and let the owner decide, without inventing an AI interpretation.
create function public.ensure_failed_request_review(p_job uuid,p_error text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare j automation_jobs; m automation_messages; d owner_decisions; rid uuid;
begin
  select * into j from automation_jobs where id=p_job;
  if not found then raise exception 'Job unavailable'; end if;
  perform 1 from projects where id=j.project_id for update;
  select * into d from owner_decisions where project_id=j.project_id and
    decision_code='DEC-'||left(replace(j.id::text,'-',''),12) for update;
  if not found then
    insert into owner_decisions(project_id,decision_code,request_code,reason,title,source_text,source_meta,explanation,history,source_job_id)
    select j.project_id,'DEC-'||left(replace(j.id::text,'-',''),12),'REQ-'||left(replace(j.id::text,'-',''),12),
      coalesce(j.review_reason,'failed_processing'),'Message requires owner review',coalesce(e.event->>'text','Non-text or membership event'),
      'Verified intake event '||j.event_id::text,'Automatic processing could not finish. The original message is preserved for your decision.',
      jsonb_build_array('Sent for owner review: '||p_error),j.id
      from automation_events e where e.id=j.event_id returning * into d;
  end if;
  update owner_decisions set source_job_id=j.id where id=d.id;
  select * into m from automation_messages where id=j.message_id and project_id=j.project_id and role='requester';
  if m.id is not null and length(trim(m.text))>0 and coalesce(j.review_reason,'failed_processing') not in ('unknown_participant','unsupported_input') then
    insert into automation_requests(project_id,job_id,ordinal,state,summary,intent,source_ids,decision_id)
      values(j.project_id,j.id,0,'owner_review',left(m.text,500),
        jsonb_build_object('intent','new_request','summary',left(m.text,500),'operation',null,'targetId',null,'payload','{}'::jsonb,
          'sources',jsonb_build_array(jsonb_build_object('revisionId',m.id,'quote',left(m.text,2000)))),
        jsonb_build_array(m.id),d.id)
      on conflict(job_id,ordinal) do nothing;
    select id into rid from automation_requests where job_id=j.id and ordinal=0;
    update owner_decisions set automation_request_id=rid,title=left(m.text,500) where id=d.id;
  end if;
  return d.id;
end $$;
revoke all on function public.ensure_failed_request_review(uuid,text) from public,anon,authenticated;
grant execute on function public.ensure_failed_request_review(uuid,text) to service_role;

-- Repair the existing fallback records instead of deleting the failed attempts.
do $$ declare j record; begin
  for j in select id,error_code from automation_jobs where state='failed' and error_code<>'source_changed' loop
    perform ensure_failed_request_review(j.id,coalesce(j.error_code,'processing_failed'));
  end loop;
end $$;

create function public.resolve_automation_review(p_decision uuid,p_action text,p_note text,p_reply text,p_key text,p_task_title text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d owner_decisions; r automation_requests; p projects; b chat_bindings;
  prior command_receipts; fingerprint text; result jsonb; tid uuid; title text; reply text; note text;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
  fingerprint:=md5(case when p_task_title is null then jsonb_build_array(p_decision,p_action,p_note,p_reply)::text
    else jsonb_build_array(p_decision,p_action,p_note,p_reply,p_task_title)::text end);
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
  select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
  if found then
    if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused' using errcode='40001'; end if;
    return prior.result;
  end if;
  select * into d from owner_decisions where id=p_decision;
  if not found or not owns_project(d.project_id) then raise insufficient_privilege; end if;
  select * into p from projects where id=d.project_id for update;
  select * into d from owner_decisions where id=p_decision for update;
  if d.deleted_at is not null or d.status not in ('open','reviewing') then raise exception 'Decision already resolved; refresh' using errcode='40001'; end if;
  if p_action is null or p_action not in ('approve','decline','dismiss','delete') then raise exception 'Unsupported review action'; end if;
  note:=case when p_action='delete' and length(trim(coalesce(p_note,'')))<3 then 'Removed from Needs Attention by owner' else trim(p_note) end;
  if length(coalesce(note,'')) not between 3 and 2000 then raise exception 'Explain your decision in 3–2000 characters'; end if;
  if length(coalesce(p_reply,''))>4000 then raise exception 'Keep the client reply within 4000 characters'; end if;
  select * into r from automation_requests where id=d.automation_request_id and project_id=p.id and decision_id=d.id for update;
  if p_action='approve' then
    if r.id is null or r.state<>'owner_review' then raise exception 'This item is an identity or delivery review, not an approvable request'; end if;
    if p.status not in ('active','review_only') then raise exception 'Resume the project before authorizing work'; end if;
    if d.reason in ('unknown_participant','delivery_unknown') then raise exception 'Verify the source before accepting work'; end if;
    title:=coalesce(nullif(trim(p_task_title),''),r.summary);
    if length(coalesce(title,'')) not between 3 and 500 then raise exception 'Enter an actionable task title in 3–500 characters'; end if;
    tid:=gen_random_uuid();
    insert into project_tasks(id,project_id,task_code,title,origin,origin_text,request_code,operation,target_id,value,
      acceptance_criteria,source_text,source_meta,authorized_by,revision_unit,agreed_due_date,history)
      values(tid,p.id,'TASK-'||left(replace(tid::text,'-',''),12),title,'manual','Approved by owner',d.request_code,
        r.intent->>'operation',r.intent->>'targetId',coalesce(r.intent#>>'{payload,replacementText}',r.intent#>>'{payload,color}'),
        (r.intent->'payload')::text,d.source_text,d.source_meta,'Owner approval: '||note,
        case when p.policy->>'allowance_mode'='per_request' then 'One individual request (owner approved)' else 'Manual round accounting' end,
        p.agreed_due_date,jsonb_build_array('Owner accepted request: '||note));
    if p.policy->>'allowance_mode'='per_request' then
      insert into automation_revision_uses(request_id,project_id,policy_version,scope_version) values(r.id,p.id,p.policy_version,p.scope_version);
    end if;
    update automation_requests set state='accepted',task_id=tid,summary=title,updated_at=now() where id=r.id;
  elsif r.id is not null then
    update automation_requests set state='closed',updated_at=now() where id=r.id;
  end if;
  reply:=trim(coalesce(p_reply,''));
  -- Approval confirmations report committed work, never model promises.
  if p_action='approve' and reply='' then
    reply:='Your request “'||left(title,160)||'” has been approved and added to the project task list. It is queued for the project owner to carry out.';
  end if;
  if p_action='delete' then reply:=''; end if;
  if reply<>'' then
    select * into b from chat_bindings where project_id=p.id;
    if r.id is null then raise exception 'Review identity or delivery issues in the project conversation before sending again'; end if;
    if p.status not in ('active','review_only') or b.project_id is null or b.hold_reason is not null or b.verified_at is null or b.test_state<>'sent'
      or b.disclosed_message_guid is null or b.instance_id is distinct from p.people->>'instance_id'
      or b.chat_guid is distinct from p.people->>'chat_guid' then raise exception 'Verify and resume the client connection before sending a reply'; end if;
    insert into automation_outbox(project_id,job_id,purpose,instance_id,chat_guid,address,text)
      values(p.id,r.job_id,'resolution:'||d.id::text,b.instance_id,b.chat_guid,p.people->>'client_sender_id',reply);
  end if;
  update owner_decisions set status=case when p_action in ('dismiss','delete') then 'dismissed' else 'resolved' end,
    deleted_at=case when p_action='delete' then now() else null end,internal_note=note,
    history=history||jsonb_build_array('Owner '||p_action||': '||note),updated_at=now() where id=d.id;
  insert into audit_events(project_id,actor_id,action,version,details)
    values(p.id,auth.uid(),'automation:review:'||p_action,p.version,jsonb_build_object('decisionId',d.id,'taskId',tid,'note',note));
  result:=jsonb_build_object('decisionId',d.id,'taskId',tid,'action',p_action,'replyQueued',reply<>'');
  insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
  return result;
end $$;
-- Keep callers of the original command compatible and under the same guards.
create or replace function public.automation_review_command(p_decision uuid,p_action text,p_note text,p_reply text,p_key text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
  select resolve_automation_review(p_decision,p_action,p_note,p_reply,p_key,null)
$$;
revoke all on function public.resolve_automation_review(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.resolve_automation_review(uuid,text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
