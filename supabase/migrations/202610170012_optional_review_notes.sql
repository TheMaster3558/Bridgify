-- Allow direct owner decisions without an undisclosed mandatory note.
-- Keep the existing authorization, row locks, receipts, task ledger and outbox atomic.
create or replace function public.resolve_automation_review(p_decision uuid,p_action text,p_note text,p_reply text,p_key text,p_task_title text default null)
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
  -- The authenticated action is the authorization. A private explanation is optional.
  if length(coalesce(p_note,''))>2000 then raise exception 'Keep the decision reason within 2000 characters'; end if;
  note:=coalesce(nullif(trim(p_note),''),case p_action
    when 'approve' then 'Accepted by owner'
    when 'decline' then 'Declined by owner'
    when 'dismiss' then 'Dismissed by owner'
    when 'delete' then 'Removed from Needs Attention by owner' end);
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
notify pgrst,'reload schema';
