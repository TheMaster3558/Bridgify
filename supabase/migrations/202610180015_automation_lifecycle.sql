alter table public.automation_outbox alter column job_id drop not null;
alter table public.automation_outbox add column retry_of uuid references public.automation_outbox on delete set null;
alter table public.automation_outbox add column attempt_started_at timestamptz;
create unique index automation_unique_provider_receipt on public.automation_outbox(provider_guid) where provider_guid is not null;
alter table public.automation_jobs add column owner_retries integer not null default 0;
alter table public.owner_decisions add column task_change_kind text;
create table public.automation_revision_refunds (
 request_id uuid primary key references public.automation_requests on delete cascade,
 project_id uuid not null references public.projects on delete cascade,
 reason text not null check(length(reason) between 3 and 2000),actor_id uuid not null references auth.users,created_at timestamptz not null default now());
create table public.automation_rounds (
 id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects on delete cascade,
 title text not null check(length(title) between 3 and 200),state text not null default 'open' check(state in ('open','closed')),
 created_at timestamptz not null default now(),closed_at timestamptz);
create unique index automation_one_open_round on public.automation_rounds(project_id) where state='open';
create table public.automation_round_members (
 request_id uuid primary key references public.automation_requests on delete cascade,
 round_id uuid not null references public.automation_rounds on delete cascade,
 project_id uuid not null references public.projects on delete cascade,created_at timestamptz not null default now());
create table public.automation_round_refunds (
 round_id uuid primary key references public.automation_rounds on delete cascade,
 project_id uuid not null references public.projects on delete cascade,
 reason text not null check(length(reason) between 3 and 2000),actor_id uuid not null references auth.users,created_at timestamptz not null default now());
create table public.automation_runtime_health (
 project_id uuid primary key references public.projects on delete cascade,
 started_at timestamptz not null default now(),finished_at timestamptz,error_code text);
do $$ declare t text; begin
 foreach t in array array['automation_revision_refunds','automation_rounds','automation_round_members','automation_round_refunds','automation_runtime_health'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy owner_read on public.%I for select to authenticated using(owns_project(project_id))',t);
 end loop;
end $$;
create index automation_task_search on public.project_tasks using gin(to_tsvector('simple',title||' '||task_code));
create index automation_request_search on public.automation_requests using gin(to_tsvector('simple',summary));

-- Internal queue helper: all recipients come from the verified saved binding.
create function public.queue_project_update(p_project uuid,p_purpose text,p_text text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; b chat_bindings;
begin
 select * into p from projects where id=p_project;
 select * into b from chat_bindings where project_id=p.id;
 if p.status not in ('active','review_only') or b.verified_at is null or b.test_state<>'sent' or b.hold_reason is not null
   or b.disclosed_message_guid is null or b.instance_id is distinct from p.people->>'instance_id'
   or b.chat_guid is distinct from p.people->>'chat_guid' then raise exception 'Verify and resume the client connection before queuing an update'; end if;
 insert into automation_outbox(project_id,purpose,instance_id,chat_guid,address,text)
 values(p.id,p_purpose,b.instance_id,b.chat_guid,p.people->>'client_sender_id',p_text);
end $$;
revoke all on function public.queue_project_update(uuid,text,text) from public,anon,authenticated;

-- Existing status command preserves concurrency/audit guards. Notifications contain no private notes.
alter function public.automation_task_status(uuid,text,timestamptz,text) rename to automation_task_status_before_progress;
revoke all on function public.automation_task_status_before_progress(uuid,text,timestamptz,text) from public,anon,authenticated;
create function public.automation_task_status(p_task uuid,p_status text,p_expected timestamptz,p_note text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t project_tasks; p projects; result jsonb; label text; previous_status text;
begin
 select status into previous_status from project_tasks where id=p_task;
 result:=automation_task_status_before_progress(p_task,p_status,p_expected,p_note);
 select * into t from project_tasks where id=p_task;
 select * into p from projects where id=t.project_id;
 if p_status is distinct from (select status from project_tasks where id=p_task) then raise exception 'Task changed'; end if;
 if previous_status is distinct from p_status and coalesce((p.policy#>>'{replies,progress_updates}')::boolean,false) and p_status in ('in_progress','blocked','done','cancelled') then
  label:=case p_status when 'in_progress' then 'is now in progress' when 'blocked' then 'is blocked; the owner is reviewing the next step' when 'done' then 'has been completed' else 'has been cancelled' end;
  perform queue_project_update(p.id,'progress:'||t.id||':'||t.updated_at::text,'Update on “'||left(t.title,160)||'”: it '||label||'.');
 end if;
 return result;
end $$;
grant execute on function public.automation_task_status(uuid,text,timestamptz,text) to authenticated;
revoke all on function public.automation_task_status(uuid,text,timestamptz,text) from public,anon;

-- Never accidentally approve a correction as a brand-new task.
alter function public.resolve_automation_review(uuid,text,text,text,text,text) rename to resolve_automation_review_before_changes;
revoke all on function public.resolve_automation_review_before_changes(uuid,text,text,text,text,text) from public,anon,authenticated;
create function public.resolve_automation_review(p_decision uuid,p_action text,p_note text,p_reply text,p_key text,p_task_title text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if p_action='approve' and exists(select 1 from owner_decisions d join automation_requests r on r.id=d.automation_request_id
  where d.id=p_decision and r.intent->>'intent' in ('correction','cancellation')) then
  raise exception 'Apply this change to an existing task from Automation; do not create new work';
 end if;
 return resolve_automation_review_before_changes(p_decision,p_action,p_note,p_reply,p_key,p_task_title);
end $$;
revoke all on function public.resolve_automation_review(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.resolve_automation_review(uuid,text,text,text,text,text) to authenticated;

create function public.automation_owner_command(p_project uuid,p_action text,p_payload jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; o automation_outbox; j automation_jobs; r automation_requests; t project_tasks; d owner_decisions;
 round automation_rounds; prior command_receipts; fingerprint text; result jsonb; new_id uuid; note text; pol jsonb; term jsonb;
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege; end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 fingerprint:=md5(jsonb_build_array(p_project,p_action,p_payload)::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused' using errcode='40001'; end if;
  return prior.result;
 end if;
 select * into p from projects where id=p_project for update;
 if p.status in ('completed','archived') then raise exception 'Closed projects cannot be changed'; end if;
 note:=trim(coalesce(p_payload->>'reason',''));
 if length(note) not between 3 and 2000 then raise exception 'Explain this action in 3–2000 characters'; end if;
 if p_action in ('outbox_edit','outbox_cancel','outbox_retry') then
  select * into o from automation_outbox where id=(p_payload->>'id')::uuid and project_id=p.id for update;
  if o.id is null then raise exception 'Reply unavailable'; end if;
  if o.updated_at is distinct from (p_payload->>'expectedUpdatedAt')::timestamptz then raise exception 'Reply changed; refresh' using errcode='40001'; end if;
  if p_action in ('outbox_edit','outbox_cancel') then
   if o.state<>'queued' then raise exception 'Only queued replies can be edited or cancelled'; end if;
   if p_action='outbox_edit' and length(trim(coalesce(p_payload->>'text',''))) not between 1 and 8000 then raise exception 'Reply must contain 1–8000 characters'; end if;
   update automation_outbox set text=case when p_action='outbox_edit' then trim(p_payload->>'text') else text end,
    state=case when p_action='outbox_cancel' then 'cancelled' else state end,updated_at=clock_timestamp() where id=o.id;
  else
   if o.state not in ('failed','unknown') or (p_payload->>'confirmedNotDelivered')::boolean is distinct from true then raise exception 'Check the conversation and explicitly confirm non-delivery before retrying'; end if;
   if p.status not in ('active','review_only') then raise exception 'Resume the project before retrying'; end if;
   new_id:=gen_random_uuid();
   perform queue_project_update(p.id,'retry:'||new_id::text,o.text);
   update automation_outbox set retry_of=o.id where project_id=p.id and purpose='retry:'||new_id::text;
   update automation_outbox set state='cancelled',updated_at=clock_timestamp() where id=o.id;
  end if;
 elsif p_action='retry_analysis' then
  select * into j from automation_jobs where id=(p_payload->>'id')::uuid and project_id=p.id for update;
  if j.id is null or j.state<>'failed' or j.review_reason is not null or j.error_code='source_changed' or j.owner_retries>=3
    or not exists(select 1 from owner_decisions where source_job_id=j.id and status in ('open','reviewing') and deleted_at is null)
    or exists(select 1 from automation_requests where job_id=j.id and (task_id is not null or state in ('accepted','closed')))
    then raise exception 'Only unresolved failed analysis without committed work can be retried (up to three owner retries)'; end if;
  if p.status not in ('active','review_only') then raise exception 'Resume the project before reprocessing'; end if;
  insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),'automation:analysis_archive',p.version,
    jsonb_build_object('job',to_jsonb(j),'requests',(select jsonb_agg(to_jsonb(x)) from automation_requests x where job_id=j.id)));
  update owner_decisions set automation_request_id=null,status='dismissed',history=history||jsonb_build_array('Owner requested fresh interpretation: '||note),updated_at=clock_timestamp() where source_job_id=j.id;
  delete from automation_requests where job_id=j.id;
  update automation_outbox set purpose='before-retry:'||j.owner_retries::text,state=case when state='queued' then 'cancelled' else state end where job_id=j.id and purpose='automation';
  update automation_jobs set state='queued',attempts=0,owner_retries=owner_retries+1,lease_token=null,lease_until=null,
    analysis=null,available_at=now(),error_code=null where id=j.id;
 elsif p_action='apply_task_change' then
  select * into r from automation_requests where id=(p_payload->>'requestId')::uuid and project_id=p.id for update;
  select * into d from owner_decisions where id=r.decision_id and project_id=p.id for update;
  if r.id is null or r.state<>'owner_review' or r.intent->>'intent' not in ('correction','cancellation')
    or d.id is null or d.status not in ('open','reviewing') or d.deleted_at is not null then raise exception 'Task change is unavailable'; end if;
  select * into t from project_tasks where id=(p_payload->>'taskId')::uuid and project_id=p.id for update;
  if t.id is null or t.updated_at is distinct from (p_payload->>'expectedUpdatedAt')::timestamptz then raise exception 'Task changed; refresh' using errcode='40001'; end if;
  if t.status in ('done','cancelled') or p.status not in ('active','review_only') then raise exception 'Only open tasks in a resumed project can be changed'; end if;
  if r.intent->>'intent'='correction' then
   if length(trim(coalesce(p_payload->>'title',''))) not between 3 and 500 then raise exception 'Enter the corrected task title'; end if;
   if length(coalesce(p_payload->>'value',''))>4000 then raise exception 'Keep the corrected value within 4000 characters'; end if;
   update project_tasks set title=trim(p_payload->>'title'),value=coalesce(nullif(p_payload->>'value',''),value),
    operation=coalesce(r.intent->>'operation',operation),target_id=coalesce(r.intent->>'targetId',target_id),
    acceptance_criteria=jsonb_build_object('ownerReviewedCorrection',r.intent,'approvedValue',p_payload->>'value')::text,
    history=history||jsonb_build_array('Owner applied client correction: '||note),updated_at=clock_timestamp() where id=t.id returning * into t;
  else
   update project_tasks set status='cancelled',history=history||jsonb_build_array('Owner accepted client cancellation: '||note),updated_at=clock_timestamp() where id=t.id returning * into t;
  end if;
  update automation_requests set task_id=t.id,state=case when r.intent->>'intent'='cancellation' then 'closed' else 'accepted' end,updated_at=now() where id=r.id;
  update owner_decisions set status='resolved',internal_note=note,history=history||jsonb_build_array('Applied to existing task '||t.task_code||': '||note),updated_at=now() where id=d.id;
  perform queue_project_update(p.id,'task-change:'||r.id::text,'Your '||case when r.intent->>'intent'='cancellation' then 'cancellation' else 'correction' end||' for “'||left(t.title,160)||'” has been applied by the owner.');
 elsif p_action='refund_request' then
  select * into r from automation_requests where id=(p_payload->>'id')::uuid and project_id=p.id;
  if r.id is null or not exists(select 1 from automation_revision_uses where request_id=r.id) then raise exception 'Accepted request usage required'; end if;
  insert into automation_revision_refunds(request_id,project_id,reason,actor_id) values(r.id,p.id,note,auth.uid());
 elsif p_action='round_open' then
  if p.policy->>'allowance_mode' is distinct from 'manual_rounds' then raise exception 'Project does not use feedback rounds'; end if;
  if (select count(*) from automation_rounds x where x.project_id=p.id and x.state='closed' and not exists(select 1 from automation_round_refunds f where f.round_id=x.id)) >= (p.policy->>'allowance')::int then raise exception 'Included rounds exhausted; amend the allowance first'; end if;
  insert into automation_rounds(project_id,title) values(p.id,left(note,200)) returning id into new_id;
 elsif p_action in ('round_add','round_close','round_refund') then
  select * into round from automation_rounds where id=(p_payload->>'id')::uuid and project_id=p.id for update;
  if round.id is null then raise exception 'Round unavailable'; end if;
  if p_action='round_add' then
   if round.state<>'open' then raise exception 'Round is closed'; end if;
   select * into r from automation_requests where id=(p_payload->>'requestId')::uuid and project_id=p.id and task_id is not null;
   if r.id is null or r.intent->>'intent' in ('correction','cancellation') then raise exception 'Choose an accepted work request'; end if;
   insert into automation_round_members(request_id,round_id,project_id) values(r.id,round.id,p.id);
  elsif p_action='round_close' then
   if round.state<>'open' or not exists(select 1 from automation_round_members where round_id=round.id) then raise exception 'Add requests to the open round before closing'; end if;
   if (select count(*) from automation_rounds x where x.project_id=p.id and x.state='closed' and not exists(select 1 from automation_round_refunds f where f.round_id=x.id)) >= (p.policy->>'allowance')::int then raise exception 'Amend the allowance before consuming this round'; end if;
   update automation_rounds set state='closed',closed_at=now() where id=round.id;
  else
   if round.state<>'closed' then raise exception 'Only consumed rounds can be refunded'; end if;
   insert into automation_round_refunds(round_id,project_id,reason,actor_id) values(round.id,p.id,note,auth.uid());
  end if;
 elsif p_action='amend_policy' then
  if p.activation_cutoff is null or p.policy is null then raise exception 'Use project setup until activation'; end if;
  if p.version is distinct from (p_payload->>'expectedVersion')::int then raise exception 'Project changed; refresh' using errcode='40001'; end if;
  pol:=p_payload->'policy';
  if not (pol ?& array['mode','allowance_mode','allowance','operations','targets','exclusions','max_open_tasks','notifications'])
    or exists(select 1 from jsonb_each(pol) where value='null'::jsonb)
    or pol->>'mode' not in ('enabled','review_only') or pol->>'allowance_mode' not in ('per_request','manual_rounds')
    or (pol->>'allowance')::int not between 0 and 10000 or (pol->>'max_open_tasks')::int not between 1 and 10
    or pol->>'notifications'<>'dashboard' or length(trim(pol->>'exclusions')) not between 1 and 4000
    then raise exception 'Invalid automation policy'; end if;
  if jsonb_typeof(pol->'operations') is distinct from 'array' or jsonb_array_length(pol->'operations')>2
    or exists(select 1 from jsonb_array_elements_text(pol->'operations') op where op not in ('replace_text','change_color'))
    or jsonb_typeof(pol->'targets') is distinct from 'array' or jsonb_array_length(pol->'targets')>30
    or exists(select 1 from jsonb_array_elements_text(pol->'targets') target where length(trim(target)) not between 1 and 200)
    then raise exception 'Invalid operations or targets'; end if;
  if pol->>'mode'='enabled' and (pol->>'allowance_mode'<>'per_request' or (pol->>'allowance')::int<1 or jsonb_array_length(pol->'operations')<1 or jsonb_array_length(pol->'targets')<1) then raise exception 'Automatic acceptance requires per-request allowance, operations and targets'; end if;
  if pol ? 'replies' and (jsonb_typeof(pol->'replies') is distinct from 'object' or exists(select 1 from jsonb_each(pol->'replies') where key not in ('status_questions','clarifications','review_acknowledgments','progress_updates') or jsonb_typeof(value)<>'boolean')) then raise exception 'Invalid reply preferences'; end if;
  if pol->>'mode'='enabled' and exists(select 1 from scope_versions s,jsonb_array_elements(s.terms) scope_term where s.project_id=p.id and s.version=p.scope_version and scope_term->>'kind'='revision' and ((scope_term->>'text')||' '||coalesce(scope_term->>'quote','')) ~* '\mrounds?\M') then raise exception 'Agreement describes rounds; keep owner approval'; end if;
  if pol->>'allowance_mode' is distinct from p.policy->>'allowance_mode' and exists(select 1 from automation_requests where project_id=p.id and task_id is not null) then raise exception 'Accounting mode cannot change after work has been accepted'; end if;
  update projects set policy=pol,policy_version=policy_version+1,version=version+1,updated_at=clock_timestamp(),
   status=case when status in ('active','review_only') then case when pol->>'mode'='enabled' then 'active' else 'review_only' end else status end where id=p.id returning * into p;
  insert into policy_versions values(p.id,p.policy_version,pol,auth.uid(),now());
 else raise exception 'Unsupported automation action';
 end if;
 result:=jsonb_build_object('projectId',p.id,'action',p_action,'id',new_id);
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),'automation:'||p_action,p.version,p_payload);
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.automation_owner_command(uuid,text,jsonb,text) from public,anon;
grant execute on function public.automation_owner_command(uuid,text,jsonb,text) to authenticated;

-- Only server code that fetched an actual provider receipt may call this.
create function public.reconcile_automation_reply(p_id uuid,p_guid text,p_text text,p_at timestamptz,p_instance text,p_chat text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare o automation_outbox;
begin
 select * into o from automation_outbox where id=p_id for update;
 if o.id is null then raise exception 'Reply unavailable'; end if;
 if o.state='sent' and o.provider_guid=p_guid then return; end if;
 if o.state not in ('failed','unknown') or o.attempt_started_at is null or o.text is distinct from p_text
  or o.instance_id is distinct from p_instance or o.chat_guid is distinct from p_chat
  or length(coalesce(p_guid,'')) not between 1 and 256 or p_at is null
  or p_at<o.attempt_started_at-interval '3 seconds' or p_at>o.attempt_started_at+interval '5 minutes'
  or exists(select 1 from automation_outbox where provider_guid=p_guid and id<>o.id) then raise exception 'Receipt does not match this send attempt'; end if;
 update automation_outbox set state='sent',provider_guid=p_guid,error_code=null,updated_at=clock_timestamp() where id=o.id;
 insert into audit_events(project_id,action,version,details) select o.project_id,'automation:receipt_reconciled',version,jsonb_build_object('outboxId',o.id,'messageId',p_guid) from projects where id=o.project_id;
end $$;
revoke all on function public.reconcile_automation_reply(uuid,text,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.reconcile_automation_reply(uuid,text,text,timestamptz,text,text) to service_role;
notify pgrst,'reload schema';
create function public.automation_accounting(p_project uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege; end if;
 return jsonb_build_object(
  'requestsUsed',(select count(*) from automation_revision_uses u where u.project_id=p_project and not exists(select 1 from automation_revision_refunds f where f.request_id=u.request_id)),
  'roundsUsed',(select count(*) from automation_rounds r where r.project_id=p_project and r.state='closed' and not exists(select 1 from automation_round_refunds f where f.round_id=r.id)),
  'queued',(select count(*) from automation_outbox where project_id=p_project and state='queued'),
  'failedJobs',(select count(*) from automation_jobs where project_id=p_project and state='failed'));
end $$;
revoke all on function public.automation_accounting(uuid) from public,anon;
grant execute on function public.automation_accounting(uuid) to authenticated;

-- Repeated failed owner retries must re-open their preserved review.
create or replace function public.ensure_failed_request_review(p_job uuid,p_error text) returns uuid
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
  update owner_decisions set source_job_id=j.id,status='open',deleted_at=null where id=d.id;
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
