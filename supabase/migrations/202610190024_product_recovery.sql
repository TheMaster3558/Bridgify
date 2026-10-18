-- Keep legacy owner RPCs behind the same commercial and allowance boundaries.
create or replace function public.resolve_automation_review(p_decision uuid,p_action text,p_note text,p_reply text,p_key text,p_task_title text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d owner_decisions;p projects;used integer;
begin
 if auth.uid() is null then raise insufficient_privilege;end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into d from owner_decisions where id=p_decision;
 if not found or not owns_project(d.project_id) then raise insufficient_privilege;end if;
 select * into p from projects where id=d.project_id for update;
 if p_action='approve' and not exists(select 1 from command_receipts where user_id=auth.uid() and key=p_key) then
  if d.reason in ('scope_addition','deadline_change') then raise exception 'Use a proposal for scope or deadline amendments';end if;
  if d.task_change_kind is not null then raise exception 'Apply this change to an existing task from Automation';end if;
  select count(*) into used from automation_revision_uses u where u.project_id=p.id and not exists(select 1 from automation_revision_refunds f where f.request_id=u.request_id);
  if p.policy->>'allowance_mode'='per_request' and used>=coalesce((p.policy->>'allowance')::int,0) and length(trim(coalesce(p_note,'')))<3 then raise exception 'Explicit extra revision authorization needs a reason';end if;
 end if;
 return resolve_automation_review_before_changes(p_decision,p_action,p_note,p_reply,p_key,p_task_title);
end $$;
revoke all on function public.resolve_automation_review(uuid,text,text,text,text,text) from public,anon;
grant execute on function public.resolve_automation_review(uuid,text,text,text,text,text) to authenticated;
create or replace function public.owner_review_command(p_decision uuid,p_expected timestamptz,p_action text,p_note text,p_reply text,p_title text,p_extra boolean,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d owner_decisions; p projects; r automation_requests; prior command_receipts; fingerprint text; result jsonb; used integer;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into d from owner_decisions where id=p_decision;
 if not found or not owns_project(d.project_id) then raise insufficient_privilege; end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 fingerprint:=md5(jsonb_build_array(p_decision,p_expected,p_action,p_note,p_reply,p_title,p_extra)::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused' using errcode='40001'; end if;
  return prior.result;
 end if;
 select * into p from projects where id=d.project_id for update;
 select * into d from owner_decisions where id=p_decision for update;
 if d.updated_at is distinct from p_expected or d.status not in ('open','reviewing') or d.deleted_at is not null then raise exception 'Decision changed; refresh' using errcode='40001'; end if;
 if p_action='approve' then
  if d.reason in ('scope_addition','deadline_change') then raise exception 'Use a proposal to approve changes to scope or deadlines'; end if;
  select count(*) into used from automation_revision_uses u where u.project_id=p.id and not exists(select 1 from automation_revision_refunds f where f.request_id=u.request_id);
  if p.policy->>'allowance_mode'='per_request' and used>=coalesce((p.policy->>'allowance')::int,0) and (p_extra is distinct from true or length(trim(coalesce(p_note,'')))<3) then raise exception 'Explicitly authorize an extra revision with a reason'; end if;
 end if;
 if p_action='clarify' then
  if length(trim(coalesce(p_reply,''))) not between 1 and 4000 then raise exception 'Write a clarification question'; end if;
  select * into r from automation_requests where id=d.automation_request_id and project_id=p.id for update;
  if r.id is null or r.state<>'owner_review' or r.clarification_turns>=2 or d.task_change_kind is not null or d.reason in ('unknown_participant','delivery_unknown') then raise exception 'This review cannot request another automatic clarification'; end if;
  perform queue_project_update(p.id,'owner-clarification:'||d.id::text||':'||r.revision,trim(p_reply));
  update automation_requests set state='awaiting_details',clarification_turns=clarification_turns+1,revision=revision+1,updated_at=clock_timestamp() where id=r.id;
  update owner_decisions set status='reviewing',history=history||jsonb_build_array('Owner requested clarification'),updated_at=clock_timestamp() where id=d.id;
  insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),'request:clarify',p.version,jsonb_build_object('requestId',r.id,'decisionId',d.id));
  result:=jsonb_build_object('projectId',p.id,'decisionId',d.id,'action',p_action);
 else
  -- Reuse the guarded task/ledger/outbox transaction with a separate child receipt.
  result:=resolve_automation_review(d.id,p_action,p_note,p_reply,md5(p_key||':review'),p_title);
 end if;
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.owner_review_command(uuid,timestamptz,text,text,text,text,boolean,text) from public,anon;
grant execute on function public.owner_review_command(uuid,timestamptz,text,text,text,text,boolean,text) to authenticated;
notify pgrst,'reload schema';

alter table public.projects add column approved_total_cents bigint generated always as (original_amount_cents+approved_additions_cents) stored;
create function public.expire_pending_proposals() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare p record;r record;n integer:=0;
begin
 for p in select id from projects where exists(select 1 from proposal_revisions where project_id=projects.id and status='awaiting_client' and expires_at<=now()) order by id limit 10 for update skip locked loop
  for r in update proposal_revisions set status='expired',version=version+1 where project_id=p.id and status='awaiting_client' and expires_at<=now() returning * loop
   update automation_outbox set state='cancelled',updated_at=clock_timestamp() where project_id=p.id and state='queued' and purpose='proposal:'||r.proposal_id::text||':r'||r.revision;
   insert into audit_events(project_id,action,version,details) values(p.id,'proposal:expired',r.version,jsonb_build_object('proposalId',r.proposal_id,'revision',r.revision));n:=n+1;
  end loop;
 end loop;return n;
end $$;
revoke all on function public.expire_pending_proposals() from public,anon,authenticated;
grant execute on function public.expire_pending_proposals() to service_role;
notify pgrst,'reload schema';

-- Page annotations must reflect all history, not only the latest 100 refunds/members.
create function public.automation_history_annotations(p_project uuid,p_requests uuid[],p_rounds uuid[]) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege;end if;
 if coalesce(cardinality(p_requests),0)>100 or coalesce(cardinality(p_rounds),0)>100 then raise exception 'History page is too large';end if;
 return jsonb_build_object(
 'openRound',(select to_jsonb(r) from automation_rounds r where r.project_id=p_project and r.state='open'),
 'roundCounts',coalesce((select jsonb_object_agg(r.id::text,(select count(*) from automation_round_members m where m.project_id=p_project and m.round_id=r.id)) from automation_rounds r where r.project_id=p_project and (r.id=any(p_rounds) or r.state='open')),'{}'),
 'members',coalesce((select jsonb_agg(to_jsonb(m)) from automation_round_members m where m.project_id=p_project and m.request_id=any(p_requests)),'[]'),
 'requestRefunds',coalesce((select jsonb_agg(to_jsonb(f)) from automation_revision_refunds f where f.project_id=p_project and f.request_id=any(p_requests)),'[]'),
 'roundRefunds',coalesce((select jsonb_agg(to_jsonb(f)) from automation_round_refunds f where f.project_id=p_project and f.round_id=any(p_rounds)),'[]'));
end $$;
revoke all on function public.automation_history_annotations(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.automation_history_annotations(uuid,uuid[],uuid[]) to authenticated;
notify pgrst,'reload schema';

-- Proposal source references must not turn a task correction into replacement work.
create function public.check_proposal_source() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.source_request_id is not null and exists(select 1 from automation_requests where id=new.source_request_id and (project_id<>new.project_id or intent->>'intent' in ('correction','cancellation'))) then raise exception 'Apply corrections or cancellations to the existing task';end if;
 return new;
end $$;
create trigger proposal_source_guard before insert or update of source_request_id,project_id on public.proposal_revisions for each row execute function public.check_proposal_source();
