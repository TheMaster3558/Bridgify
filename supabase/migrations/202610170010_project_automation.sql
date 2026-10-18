-- Uses the project creation schema. Legacy intake was an independent prototype
-- with colliding table names; its SQL is retained in supabase/legacy for tests.
create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects,
  instance_id text not null,
  event_key text not null,
  fingerprint text not null,
  event jsonb not null,
  disposition text not null,
  created_at timestamptz not null default now(),
  unique(instance_id,event_key)
);
create table public.automation_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects,
  event_id uuid unique references public.automation_events,
  provider_guid text not null,
  role text not null check(role in ('requester','owner','assistant','unknown')),
  text text not null check(length(text)<=30000),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(project_id,provider_guid)
);
create table public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects,
  event_id uuid not null unique references public.automation_events,
  message_id uuid references public.automation_messages,
  review_reason text,
  state text not null default 'queued' check(state in ('queued','running','done','failed')),
  attempts integer not null default 0,
  lease_token uuid,
  lease_until timestamptz,
  available_at timestamptz not null default now(),
  error_code text,
  analysis jsonb,
  model text,
  prompt_version text,
  created_at timestamptz not null default now()
);
create table public.automation_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects,
  job_id uuid not null references public.automation_jobs,
  ordinal integer not null,
  revision integer not null default 1,
  state text not null check(state in ('awaiting_details','accepted','owner_review','closed')),
  summary text not null,
  intent jsonb not null,
  source_ids jsonb not null,
  clarification_turns integer not null default 0,
  task_id uuid references public.project_tasks,
  decision_id uuid references public.owner_decisions,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id,ordinal)
);
-- Immutable ledger counts accepted requests across policy versions. Cancellation
-- does not silently refund a contractual revision.
create table public.automation_revision_uses (
  request_id uuid primary key references public.automation_requests,
  project_id uuid not null references public.projects,
  policy_version integer not null,
  scope_version integer not null,
  created_at timestamptz not null default now()
);
create table public.automation_outbox (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects,
  job_id uuid not null references public.automation_jobs,
  purpose text not null default 'automation',
  instance_id text not null,
  chat_guid text not null,
  address text not null,
  text text not null check(length(text) between 1 and 8000),
  state text not null default 'queued' check(state in ('queued','sending','sent','failed','unknown','cancelled')),
  provider_guid text,
  lease_token uuid,
  lease_until timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(job_id,purpose)
);
create index automation_jobs_ready on public.automation_jobs(state,available_at);
create index automation_messages_context on public.automation_messages(project_id,created_at);
create index automation_outbox_ready on public.automation_outbox(state,created_at);
create index automation_requests_pending on public.automation_requests(project_id,state);
alter table public.owner_decisions add column automation_request_id uuid references public.automation_requests;
do $$ declare t text; begin
  foreach t in array array['automation_events','automation_messages','automation_jobs','automation_requests','automation_revision_uses','automation_outbox'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner_read on public.%I for select to authenticated using(public.owns_project(project_id))',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('grant all on public.%I to service_role',t);
  end loop;
end $$;

-- Owner commands use the same project lock as automatic acceptance. Public
-- clients cannot manufacture authorizations or mutate the accounting ledger.
create function public.automation_review_command(p_decision uuid,p_action text,p_note text,p_reply text,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d owner_decisions; r automation_requests; p projects; b chat_bindings;
  prior command_receipts; fingerprint text; result jsonb; tid uuid;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
  fingerprint:=md5(jsonb_build_array(p_decision,p_action,p_note,p_reply)::text);
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
  if d.status not in ('open','reviewing') then raise exception 'Decision already resolved; refresh' using errcode='40001'; end if;
  if p_action not in ('approve','decline','dismiss') then raise exception 'Unsupported review action'; end if;
  if length(trim(coalesce(p_note,''))) not between 3 and 2000 then raise exception 'Explain your decision in 3–2000 characters'; end if;
  if length(coalesce(p_reply,''))>4000 then raise exception 'Keep the client reply within 4000 characters'; end if;
  select * into r from automation_requests where decision_id=d.id for update;
  if p_action='approve' then
    if r.id is null or r.state<>'owner_review' then raise exception 'This item is a message or delivery review, not an approvable request'; end if;
    if p.status not in ('active','review_only') then raise exception 'Resume the project before authorizing work'; end if;
    if d.reason in ('unknown_participant','unsupported_input','failed_processing','delivery_unknown') then raise exception 'Verify the source before accepting work'; end if;
    -- Owner override is explicit and recorded, including work beyond allowance.
    tid:=gen_random_uuid();
    insert into project_tasks(id,project_id,task_code,title,origin,origin_text,request_code,operation,target_id,value,
      acceptance_criteria,source_text,source_meta,authorized_by,revision_unit,agreed_due_date,history)
    values(tid,p.id,'TASK-'||left(replace(tid::text,'-',''),12),left(r.summary,500),'manual','Approved by owner',d.request_code,
      r.intent->>'operation',r.intent->>'targetId',coalesce(r.intent#>>'{payload,replacementText}',r.intent#>>'{payload,color}'),
      (r.intent->'payload')::text,d.source_text,d.source_meta,'Owner approval: '||p_note,
      case when p.policy->>'allowance_mode'='per_request' then 'One individual request (owner approved)' else 'Manual round accounting' end,
      p.agreed_due_date,jsonb_build_array('Owner accepted request: '||p_note));
    if p.policy->>'allowance_mode'='per_request' then
      insert into automation_revision_uses(request_id,project_id,policy_version,scope_version) values(r.id,p.id,p.policy_version,p.scope_version);
    end if;
    update automation_requests set state='accepted',task_id=tid,updated_at=now() where id=r.id;
  elsif r.id is not null then
    update automation_requests set state='closed',updated_at=now() where id=r.id;
  end if;
  if length(trim(coalesce(p_reply,'')))>0 then
    select * into b from chat_bindings where project_id=p.id;
    if r.id is null then raise exception 'Send message or delivery follow-ups from the project conversation after reviewing the delivery state'; end if;
    if p.status not in ('active','review_only') or b.hold_reason is not null or b.verified_at is null or b.test_state<>'sent'
      or b.disclosed_message_guid is null then raise exception 'Verify and resume the client connection before sending a reply'; end if;
    insert into automation_outbox(project_id,job_id,purpose,instance_id,chat_guid,address,text)
      values(p.id,r.job_id,'resolution:'||d.id::text,b.instance_id,b.chat_guid,p.people->>'client_sender_id',trim(p_reply));
  end if;
  update owner_decisions set status=case when p_action='dismiss' then 'dismissed' else 'resolved' end,
    internal_note=p_note,history=history||jsonb_build_array('Owner '||p_action||': '||p_note),updated_at=now() where id=d.id;
  insert into audit_events(project_id,actor_id,action,version,details)
    values(p.id,auth.uid(),'automation:review:'||p_action,p.version,jsonb_build_object('decisionId',d.id,'taskId',tid,'note',p_note));
  result:=jsonb_build_object('decisionId',d.id,'taskId',tid,'action',p_action);
  insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
  return result;
end $$;

create function public.automation_task_status(p_task uuid,p_status text,p_expected timestamptz,p_note text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t project_tasks; p projects;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  select * into t from project_tasks where id=p_task;
  if not found or not owns_project(t.project_id) then raise insufficient_privilege; end if;
  select * into p from projects where id=t.project_id for update;
  select * into t from project_tasks where id=p_task for update;
  if t.updated_at is distinct from p_expected then raise exception 'Task changed; refresh' using errcode='40001'; end if;
  if p.status not in ('active','review_only') then raise exception 'Resume the project before changing tasks'; end if;
  if p_status not in ('ready','in_progress','blocked','done','cancelled') then raise exception 'Unsupported task status'; end if;
  if p_status in ('blocked','cancelled') and length(trim(coalesce(p_note,'')))<3 then raise exception 'Explain why the task is blocked or cancelled'; end if;
  if length(coalesce(p_note,''))>2000 then raise exception 'Keep the note within 2000 characters'; end if;
  update project_tasks set status=p_status,blocked_reason=case when p_status='blocked' then p_note else null end,
    history=history||jsonb_build_array('Owner changed status to '||p_status||case when coalesce(p_note,'')<>'' then ': '||p_note else '' end),updated_at=clock_timestamp()
    where id=t.id returning * into t;
  insert into audit_events(project_id,actor_id,action,version,details)
    values(p.id,auth.uid(),'automation:task_status',p.version,jsonb_build_object('taskId',t.id,'status',p_status));
  return to_jsonb(t);
end $$;
revoke all on function public.automation_review_command(uuid,text,text,text,text),public.automation_task_status(uuid,text,timestamptz,text) from public,anon;
grant execute on function public.automation_review_command(uuid,text,text,text,text),public.automation_task_status(uuid,text,timestamptz,text) to authenticated;
