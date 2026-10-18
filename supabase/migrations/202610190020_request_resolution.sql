create function public.owner_review_command(p_decision uuid,p_expected timestamptz,p_action text,p_note text,p_reply text,p_title text,p_extra boolean,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d owner_decisions; p projects; r automation_requests; prior command_receipts; fingerprint text; result jsonb;
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
  if d.reason='exhausted_allowance' and (p_extra is distinct from true or length(trim(coalesce(p_note,'')))<3) then raise exception 'Explicitly authorize an extra revision with a reason'; end if;
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
