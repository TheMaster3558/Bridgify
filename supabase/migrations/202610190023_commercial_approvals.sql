alter table public.projects add column approved_additions_cents bigint not null default 0 check(approved_additions_cents>=0);
alter table public.project_tasks add column proposal_id uuid,add column proposal_revision integer,add column proposal_line_key text;
create unique index proposal_task_once on public.project_tasks(proposal_id,proposal_revision,proposal_line_key) where proposal_id is not null;
create table public.proposal_responses(
 proposal_id uuid not null,revision integer not null,project_id uuid not null references public.projects on delete cascade,
 outcome text not null check(outcome in ('approved','declined','changes_requested')),terms_hash text not null,
 recorded_by uuid not null references auth.users,evidence jsonb not null,note text not null,created_at timestamptz not null default now(),
 primary key(proposal_id,revision),foreign key(proposal_id,revision) references public.proposal_revisions on delete cascade
);
alter table public.proposal_responses enable row level security;
create policy owner_read on public.proposal_responses for select to authenticated using(owns_project(project_id));
revoke all on public.proposal_responses from public,anon,authenticated;
grant select on public.proposal_responses to authenticated;grant all on public.proposal_responses to service_role;

-- Include any explicitly replaced agreement terms in the immutable outgoing text.
alter function public.owner_proposal_command(uuid,uuid,integer,integer,text,jsonb,text) rename to owner_proposal_command_before_amendments;
revoke all on function public.owner_proposal_command_before_amendments(uuid,uuid,integer,integer,text,jsonb,text) from public,anon,authenticated;
create function public.owner_proposal_command(p_project uuid,p_proposal uuid,p_revision integer,p_expected integer,p_action text,p_terms jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;r proposal_revisions;p projects;replayed boolean;replacement text;
begin
 replayed:=exists(select 1 from command_receipts where user_id=auth.uid() and key=p_key);
 result:=owner_proposal_command_before_amendments(p_project,p_proposal,p_revision,p_expected,p_action,p_terms,p_key);
 if p_action='replace' and not replayed then
  select * into r from proposal_revisions where proposal_id=(result->>'proposal_id')::uuid and revision=(result->>'revision')::int;
  if r.source_request_id is not null and exists(select 1 from proposal_responses where proposal_id=r.proposal_id and revision=r.revision-1 and outcome='declined') then
   update automation_requests set state='owner_review',updated_at=clock_timestamp() where id=r.source_request_id and project_id=r.project_id and state='closed' and task_id is null;
   update owner_decisions set status='open',history=history||jsonb_build_array('Owner prepared a replacement commercial proposal'),updated_at=clock_timestamp() where automation_request_id=r.source_request_id and project_id=r.project_id and deleted_at is null;
  end if;
 end if;
 if p_action='send' and not replayed then
  select * into p from projects where id=p_project;
  select * into r from proposal_revisions where proposal_id=p_proposal and revision=p_revision;
  if r.shared_terms ? 'superseded_terms' then
   if jsonb_typeof(r.shared_terms->'superseded_terms')<>'array' or jsonb_array_length(r.shared_terms->'superseded_terms')>100
    or exists(select 1 from jsonb_array_elements_text(r.shared_terms->'superseded_terms') x where not exists(select 1 from scope_versions s,jsonb_array_elements(s.terms) t where s.project_id=p.id and s.version=p.scope_version and t->>'text'=x)) then raise exception 'Replaced terms must belong to the current confirmed scope';end if;
   select string_agg(x,E'\n- ') into replacement from jsonb_array_elements_text(r.shared_terms->'superseded_terms') x;
   if replacement is not null then
    replacement:=r.frozen_text||E'\nCurrent agreement terms replaced by this proposal:\n- '||replacement;
    if length(replacement)>8000 then raise exception 'Proposal is too long; shorten its terms';end if;
    update proposal_revisions set frozen_text=replacement where proposal_id=r.proposal_id and revision=r.revision returning * into r;
    update automation_outbox set text=replacement where project_id=p.id and purpose='proposal:'||r.proposal_id::text||':r'||r.revision and state='queued';
    result:=to_jsonb(r);update command_receipts set result=to_jsonb(r) where user_id=auth.uid() and key=p_key;
   end if;
  end if;
 end if;
 return result;
end $$;
revoke all on function public.owner_proposal_command(uuid,uuid,integer,integer,text,jsonb,text) from public,anon;
grant execute on function public.owner_proposal_command(uuid,uuid,integer,integer,text,jsonb,text) to authenticated;

create function public.record_proposal_response(p_project uuid,p_proposal uuid,p_revision integer,p_expected integer,p_project_version integer,p_hash text,p_outcome text,p_evidence uuid[],p_confirmed boolean,p_note text,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects;r proposal_revisions;s scope_versions;prior command_receipts;fingerprint text;result jsonb;proof jsonb;terms jsonb;line jsonb;tid uuid;first_task uuid;delta integer;used integer;new_allowance integer;existing proposal_responses;
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege;end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required';end if;
 fingerprint:=md5(jsonb_build_array(p_project,p_proposal,p_revision,p_expected,p_project_version,p_hash,p_outcome,p_evidence,p_confirmed,p_note)::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused' using errcode='40001';end if;return prior.result;end if;
 select * into p from projects where id=p_project for update;
 select * into r from proposal_revisions where proposal_id=p_proposal and revision=p_revision and project_id=p.id for update;
 if r.proposal_id is null then raise insufficient_privilege;end if;
 -- Another identical approval may safely return the recorded effect, never apply twice.
 select * into existing from proposal_responses where proposal_id=r.proposal_id and revision=r.revision;
 if found then
  if existing.outcome=p_outcome and existing.terms_hash=p_hash and p_confirmed is true then return jsonb_build_object('projectId',p.id,'proposalId',r.proposal_id,'revision',r.revision,'outcome',existing.outcome,'alreadyRecorded',true);end if;
  raise exception 'This revision already has a different recorded response' using errcode='40001';
 end if;
 if r.version is distinct from p_expected or p.version is distinct from p_project_version or r.revision<>(select max(revision) from proposal_revisions where proposal_id=r.proposal_id)
  or r.status<>'awaiting_client' or r.terms_hash is distinct from p_hash or r.terms_hash is null then raise exception 'Proposal or project changed; review the current terms' using errcode='40001';end if;
 if p.status not in ('active','review_only') or r.expected_scope_version is distinct from p.scope_version then raise exception 'Resume the project and rebase the proposal onto its current scope';end if;
 if r.expires_at is not null and r.expires_at<=now() then raise exception 'This proposal expired; send a replacement revision';end if;
 if p_outcome not in ('approved','declined','changes_requested') or p_confirmed is distinct from true or length(trim(coalesce(p_note,''))) not between 3 and 2000
  or coalesce(cardinality(p_evidence),0) not between 1 and 10 then raise exception 'Record client evidence, an explanation and explicit confirmation';end if;
 if r.client_sender_id is distinct from p.people->>'client_sender_id' then raise exception 'The proposal belongs to a different client identity';end if;
 if not exists(select 1 from automation_outbox where project_id=p.id and purpose='proposal:'||r.proposal_id::text||':r'||r.revision and state='sent' and provider_guid is not null and text=r.frozen_text) then raise exception 'Verify the actual proposal submission receipt before recording a response';end if;
 select jsonb_agg(jsonb_build_object('messageId',m.id,'providerGuid',m.provider_guid,'text',m.text,'occurredAt',m.occurred_at,'senderId',e.event->>'senderId')) into proof
  from automation_messages m join automation_events e on e.id=m.event_id
  where m.project_id=p.id and m.id=any(p_evidence) and m.role='requester' and length(trim(m.text))>0 and m.occurred_at>=r.sent_at-interval '3 seconds'
  and e.instance_id=p.people->>'instance_id' and e.event->>'chatGuid'=p.people->>'chat_guid' and e.event->>'senderId'=r.client_sender_id
  and coalesce(e.event->>'direction','inbound')='inbound' and m.occurred_at<=now()+interval '30 seconds'
  and e.disposition in ('pending_analysis','courtesy_context')
  and not exists(select 1 from automation_events mutation where mutation.project_id=p.id and mutation.event->>'messageGuid'=m.provider_guid and mutation.event->>'kind' in ('edit','delete'));
 if coalesce(jsonb_array_length(proof),0)<>cardinality(p_evidence) then raise exception 'Evidence must be distinct, unedited client messages after this revision was sent in the same conversation';end if;
 if exists(select 1 from automation_requests a where a.project_id=p.id and a.task_id is not null and exists(select 1 from jsonb_array_elements_text(a.source_ids) x where x=any(p_evidence::text[]))) then raise exception 'Evidence already authorized separate work; resolve that work before recording commercial approval';end if;
 -- Explicitly selected response evidence must not later become another routine task.
 update automation_jobs set state='done',lease_token=null,lease_until=null where project_id=p.id and message_id=any(p_evidence) and state in ('queued','running','failed');
 update owner_decisions set status='resolved',history=history||jsonb_build_array('Owner linked the source as a commercial response'),updated_at=clock_timestamp()
  where project_id=p.id and automation_request_id in(select a.id from automation_requests a where a.project_id=p.id and a.job_id in(select id from automation_jobs where message_id=any(p_evidence))) and status in ('open','reviewing');
 update automation_requests set state='closed',updated_at=clock_timestamp() where project_id=p.id and task_id is null and job_id in(select id from automation_jobs where project_id=p.id and message_id=any(p_evidence));
 if p_outcome='approved' then
  if r.source_request_id is not null and not exists(select 1 from automation_requests where id=r.source_request_id and project_id=p.id and state='owner_review' and task_id is null) then raise exception 'The source request has already been handled';end if;
  select * into s from scope_versions where project_id=p.id and version=p.scope_version;
  terms:=coalesce((select jsonb_agg(t) from jsonb_array_elements(s.terms) t where not exists(select 1 from jsonb_array_elements_text(coalesce(r.shared_terms->'superseded_terms','[]')) x where t->>'text'=x)),'[]');
  for line in select * from jsonb_array_elements(r.shared_terms->'lines') loop
   terms:=terms||jsonb_build_array(jsonb_build_object('kind','inclusion','text',(line->>'title')||case when coalesce(line->>'acceptance_criteria','')<>'' then ': '||(line->>'acceptance_criteria') else '' end,'quote',line->>'title','proposal_id',r.proposal_id,'proposal_revision',r.revision));
  end loop;
  for line in select * from jsonb_array_elements(r.shared_terms->'exclusions') loop
   terms:=terms||jsonb_build_array(jsonb_build_object('kind','exclusion','text',line#>>'{}','quote',line#>>'{}','proposal_id',r.proposal_id,'proposal_revision',r.revision));
  end loop;
  delta:=(r.shared_terms->>'allowance_delta')::int;new_allowance:=coalesce((p.policy->>'allowance')::int,0)+delta;
  if p.policy->>'allowance_mode'='manual_rounds' then select count(*) into used from automation_rounds x where project_id=p.id and state='closed' and not exists(select 1 from automation_round_refunds f where f.round_id=x.id);
  else select count(*) into used from automation_revision_uses x where project_id=p.id and not exists(select 1 from automation_revision_refunds f where f.request_id=x.request_id);end if;
  if new_allowance not between 0 and 10000 or new_allowance<used then raise exception 'Amended entitlement cannot be below retained usage or outside supported limits';end if;
  insert into scope_versions(project_id,version,document_id,terms,agreement,confirmed_by) values(p.id,p.scope_version+1,s.document_id,terms,s.agreement,auth.uid());
  update projects set scope_version=scope_version+1,approved_additions_cents=approved_additions_cents+(r.shared_terms->>'amount_cents')::bigint,
   agreed_due_date=case when (r.shared_terms->>'change_due_date')::boolean then (r.shared_terms->>'new_due_date')::date else agreed_due_date end,
   policy=case when delta<>0 then jsonb_set(policy,'{allowance}',to_jsonb(new_allowance)) else policy end,
   policy_version=policy_version+case when delta<>0 then 1 else 0 end,version=version+1,updated_at=clock_timestamp() where id=p.id returning * into p;
  if delta<>0 then insert into policy_versions values(p.id,p.policy_version,p.policy,auth.uid(),now());end if;
  for line in select * from jsonb_array_elements(r.shared_terms->'lines') loop
   insert into project_tasks(project_id,task_code,title,origin,origin_text,operation,value,acceptance_criteria,source_text,source_meta,authorized_by,agreed_due_date,history,proposal_id,proposal_revision,proposal_line_key)
    values(p.id,'TASK-'||left(replace(gen_random_uuid()::text,'-',''),12),line->>'title','proposal','Approved proposal revision '||r.revision,'project_change',line->>'title',line->>'acceptance_criteria',r.frozen_text,'Proposal '||r.proposal_id||' revision '||r.revision,auth.uid()::text,p.agreed_due_date,jsonb_build_array('Owner recorded client approval against frozen terms'),r.proposal_id,r.revision,line->>'key') returning id into tid;
   first_task:=coalesce(first_task,tid);
  end loop;
  if r.source_request_id is not null then
   update automation_requests set state='accepted',task_id=first_task,updated_at=clock_timestamp() where id=r.source_request_id;
   update owner_decisions set status='resolved',history=history||jsonb_build_array('Client-approved proposal recorded by owner'),updated_at=clock_timestamp() where automation_request_id=r.source_request_id;
  end if;
  perform queue_project_update(p.id,'proposal-approved:'||r.proposal_id::text||':r'||r.revision,'The owner recorded your approval of proposal P-'||left(r.proposal_id::text,8)||' revision '||r.revision||'. Its deliverables are now in the project task list for the owner to carry out.');
 end if;
 if p_outcome='declined' and r.source_request_id is not null then
  update automation_requests set state='closed',updated_at=clock_timestamp() where id=r.source_request_id and project_id=p.id and task_id is null;
  update owner_decisions set status='resolved',history=history||jsonb_build_array('Owner recorded the client declining the proposal'),updated_at=clock_timestamp() where automation_request_id=r.source_request_id and project_id=p.id;
 end if;
 insert into proposal_responses(proposal_id,revision,project_id,outcome,terms_hash,recorded_by,evidence,note) values(r.proposal_id,r.revision,p.id,p_outcome,r.terms_hash,auth.uid(),proof,trim(p_note));
 update proposal_revisions set status=p_outcome,version=version+1 where proposal_id=r.proposal_id and revision=r.revision;
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),'proposal:response:'||p_outcome,p.version,jsonb_build_object('proposalId',r.proposal_id,'revision',r.revision,'termsHash',r.terms_hash,'evidence',p_evidence));
 result:=jsonb_build_object('projectId',p.id,'proposalId',r.proposal_id,'revision',r.revision,'outcome',p_outcome);
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);return result;
end $$;
revoke all on function public.record_proposal_response(uuid,uuid,integer,integer,integer,text,text,uuid[],boolean,text,text) from public,anon;
grant execute on function public.record_proposal_response(uuid,uuid,integer,integer,integer,text,text,uuid[],boolean,text,text) to authenticated;

-- Frozen commercial terms cannot be edited via generic reply controls.
alter function public.automation_owner_command(uuid,text,jsonb,text) rename to automation_owner_command_before_commercial;
revoke all on function public.automation_owner_command_before_commercial(uuid,text,jsonb,text) from public,anon,authenticated;
create function public.automation_owner_command(p_project uuid,p_action text,p_payload jsonb,p_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare o automation_outbox;result jsonb;
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege;end if;
 if p_action in ('outbox_edit','outbox_cancel') then
  perform 1 from projects where id=p_project for update;
  select * into o from automation_outbox where project_id=p_project and id=(p_payload->>'id')::uuid;
  if p_action='outbox_edit' and o.purpose like 'proposal:%' then raise exception 'Proposal terms are immutable; replace the proposal revision instead';end if;
 end if;
 result:=automation_owner_command_before_commercial(p_project,p_action,p_payload,p_key);
 if p_action='outbox_cancel' and o.purpose like 'proposal:%' then
  update proposal_revisions set status='withdrawn',version=version+1 where project_id=p_project and status='awaiting_client' and 'proposal:'||proposal_id::text||':r'||revision=o.purpose;
 end if;
 return result;
end $$;
revoke all on function public.automation_owner_command(uuid,text,jsonb,text) from public,anon;
grant execute on function public.automation_owner_command(uuid,text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
