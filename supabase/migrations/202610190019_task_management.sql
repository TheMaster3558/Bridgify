alter table public.project_tasks add column internal_due_date date;
create function public.owner_task_command(p_project uuid,p_task uuid,p_expected timestamptz,p_action text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; t project_tasks; prior command_receipts; fingerprint text; result jsonb;
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege; end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 fingerprint:=md5(p_project::text||coalesce(p_task::text,'')||coalesce(p_expected::text,'')||p_action||p_payload::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused with different input' using errcode='40001'; end if;
  return prior.result;
 end if;
 select * into p from projects where id=p_project for update;
 if p.status not in ('active','review_only') then raise exception 'Resume the project before changing tasks'; end if;
 if p_action not in ('create','edit','status') then raise exception 'Unsupported task command'; end if;
 if p_action<>'create' then
  select * into t from project_tasks where id=p_task and project_id=p.id for update;
  if not found then raise insufficient_privilege; end if;
  if t.updated_at is distinct from p_expected then raise exception 'Task changed; refresh' using errcode='40001'; end if;
 end if;
 if p_action='status' then
  result:=automation_task_status(t.id,p_payload->>'status',p_expected,p_payload->>'note');
 else
  if length(trim(coalesce(p_payload->>'title',''))) not between 1 and 500
    or length(coalesce(p_payload->>'instructions',''))>8000
    or length(coalesce(p_payload->>'acceptance_criteria',''))>4000
    or length(coalesce(p_payload->>'internal_note',''))>4000
    or p_payload->>'priority' not in ('high','normal','low') then raise exception 'Invalid task details'; end if;
  if p_action='create' then
   if p_task is not null then raise exception 'New tasks cannot supply an existing identity'; end if;
   insert into project_tasks(project_id,task_code,title,origin,origin_text,authorized_by)
   values(p.id,'TASK-'||left(replace(gen_random_uuid()::text,'-',''),12),trim(p_payload->>'title'),'manual','Created by owner',auth.uid()::text) returning * into t;
  end if;
  update project_tasks set title=trim(p_payload->>'title'),value=p_payload->>'instructions',
   acceptance_criteria=nullif(p_payload->>'acceptance_criteria',''),priority=p_payload->>'priority',
   internal_due_date=nullif(p_payload->>'internal_due_date','')::date,internal_note=nullif(p_payload->>'internal_note',''),
   history=history||jsonb_build_array('Owner '||case when p_action='create' then 'created task' else 'edited task details' end),updated_at=clock_timestamp()
   where id=t.id returning * into t;
  insert into audit_events(project_id,actor_id,action,version,details)
   values(p.id,auth.uid(),'task:'||p_action,p.version,jsonb_build_object('taskId',t.id));
  result:=to_jsonb(t);
 end if;
 insert into command_receipts(user_id,key,fingerprint,result) values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.owner_task_command(uuid,uuid,timestamptz,text,jsonb,text) from public,anon;
grant execute on function public.owner_task_command(uuid,uuid,timestamptz,text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
