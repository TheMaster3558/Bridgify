alter table public.proposal_revisions add column version integer not null default 1;
alter table public.proposal_revisions add column terms_hash text;
alter table public.proposal_revisions add column frozen_text text;
alter table public.proposal_revisions add column sent_at timestamptz;
alter table public.proposal_revisions add column expected_scope_version integer;
alter table public.proposal_revisions add column client_sender_id text;
alter table public.proposal_revisions add column source_request_id uuid references public.automation_requests on delete set null;
create function public.validate_proposal_terms(t jsonb) returns void language plpgsql set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(t) is distinct from 'object' or not(t ?& array['title','explanation','lines','exclusions','amount_cents','change_due_date','new_due_date','allowance_delta','expires_at'])
  or length(trim(coalesce(t->>'title',''))) not between 1 and 200
  or length(trim(coalesce(t->>'explanation',''))) not between 1 and 4000
  or jsonb_typeof(t->'amount_cents') is distinct from 'number' or (t->>'amount_cents')::numeric<>trunc((t->>'amount_cents')::numeric) or (t->>'amount_cents')::numeric not between 0 and 100000000
  or jsonb_typeof(t->'allowance_delta') is distinct from 'number' or (t->>'allowance_delta')::numeric<>trunc((t->>'allowance_delta')::numeric) or (t->>'allowance_delta')::numeric not between -10000 and 10000
  or jsonb_typeof(t->'change_due_date') is distinct from 'boolean'
  or jsonb_typeof(t->'lines') is distinct from 'array' or jsonb_array_length(t->'lines') not between 1 and 25
  or jsonb_typeof(t->'exclusions') is distinct from 'array' or jsonb_array_length(t->'exclusions')>25 then raise exception 'Invalid proposal terms';end if;
 if exists(select 1 from jsonb_array_elements(t->'lines') l where length(trim(coalesce(l->>'key',''))) not between 1 and 100 or length(trim(coalesce(l->>'title',''))) not between 1 and 500 or length(coalesce(l->>'acceptance_criteria',''))>2000)
  or (select count(*) from jsonb_array_elements(t->'lines'))<>(select count(distinct l->>'key') from jsonb_array_elements(t->'lines') l)
  or exists(select 1 from jsonb_array_elements(t->'exclusions') x where jsonb_typeof(x)<>'string' or length(trim(x#>>'{}')) not between 1 and 1000) then raise exception 'Invalid deliverables or exclusions';end if;
 if t->>'new_due_date' is not null then perform (t->>'new_due_date')::date;end if;
 if t->>'expires_at' is not null then perform (t->>'expires_at')::timestamptz;end if;
end $$;
revoke all on function public.validate_proposal_terms(jsonb) from public,anon,authenticated;
create function public.owner_proposal_command(p_project uuid,p_proposal uuid,p_revision integer,p_expected integer,p_action text,p_terms jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare p projects; r proposal_revisions; prior command_receipts; fingerprint text; result jsonb; outgoing text; amount text; line text;
begin
 if auth.uid() is null or not owns_project(p_project) then raise insufficient_privilege;end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required';end if;
 fingerprint:=md5(jsonb_build_array(p_project,p_proposal,p_revision,p_expected,p_action,p_terms)::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused' using errcode='40001';end if;return prior.result;end if;
 select * into p from projects where id=p_project for update;
 if p.status not in ('active','paused','review_only') or p.scope_version<1 then raise exception 'Activate the project before preparing proposals';end if;
 if p_action='create' then
  if p_proposal is not null or p_revision is not null then raise exception 'New proposals cannot reuse a proposal identity';end if;
  perform validate_proposal_terms(p_terms);
  if p_terms->>'source_request_id' is not null and not exists(select 1 from automation_requests where id=(p_terms->>'source_request_id')::uuid and project_id=p.id and state='owner_review') then raise exception 'Choose an unresolved request in this project';end if;
  insert into proposal_revisions(proposal_id,revision,project_id,status,shared_terms,expires_at,expected_scope_version,client_sender_id,source_request_id)
   values(gen_random_uuid(),1,p.id,'draft',p_terms,(p_terms->>'expires_at')::timestamptz,p.scope_version,p.people->>'client_sender_id',(p_terms->>'source_request_id')::uuid) returning * into r;
 else
  select * into r from proposal_revisions where proposal_id=p_proposal and revision=p_revision and project_id=p.id for update;
  if r.proposal_id is null then raise insufficient_privilege;end if;
  if r.version is distinct from p_expected or r.revision<>(select max(revision) from proposal_revisions where proposal_id=r.proposal_id) then raise exception 'Proposal changed; refresh' using errcode='40001';end if;
  if p_action='draft' then
   if r.status<>'draft' then raise exception 'Sent terms are immutable; create a replacement revision';end if;
   perform validate_proposal_terms(p_terms);
   if (p_terms->>'source_request_id')::uuid is distinct from r.source_request_id then raise exception 'A draft cannot change its source request';end if;
   update proposal_revisions set shared_terms=p_terms,expires_at=(p_terms->>'expires_at')::timestamptz,expected_scope_version=p.scope_version,version=version+1 where proposal_id=r.proposal_id and revision=r.revision returning * into r;
  elsif p_action='send' then
   if r.status<>'draft' or r.expected_scope_version is distinct from p.scope_version then raise exception 'Review the current scope and save the draft before sending';end if;
   perform validate_proposal_terms(r.shared_terms);
   if r.expires_at is not null and r.expires_at<=now() then raise exception 'Choose a future expiry';end if;
   if r.client_sender_id is distinct from p.people->>'client_sender_id' then raise exception 'Proposal client identity changed';end if;
   select string_agg('- '||(l->>'title')||case when coalesce(l->>'acceptance_criteria','')<>'' then E'\n  Acceptance: '||(l->>'acceptance_criteria') else '' end,E'\n') into line from jsonb_array_elements(r.shared_terms->'lines') l;
   amount:=to_char((r.shared_terms->>'amount_cents')::numeric/100,'FM999999990.00');
   outgoing:='Proposal P-'||left(r.proposal_id::text,8)||' revision '||r.revision||E'\n'||(r.shared_terms->>'title')||E'\n'||(r.shared_terms->>'explanation')||E'\nDeliverables:\n'||line||E'\nExclusions: '||coalesce((select string_agg(x,E'; ') from jsonb_array_elements_text(r.shared_terms->'exclusions') x),'None')||E'\nAdditional project price: '||p.currency||' '||amount||E'\nDeadline: '||case when (r.shared_terms->>'change_due_date')::boolean then coalesce(r.shared_terms->>'new_due_date','No agreed date') else 'Unchanged' end||E'\nRevision allowance adjustment: '||(r.shared_terms->>'allowance_delta')||E'\nExpires: '||coalesce(r.expires_at::text,'No expiry')||E'\nPlease discuss these exact terms here. The owner will record your decision before any new work is authorized.';
   if length(outgoing)>8000 then raise exception 'Proposal is too long for one message; shorten the draft';end if;
   perform queue_project_update(p.id,'proposal:'||r.proposal_id::text||':r'||r.revision,outgoing);
   update proposal_revisions set terms_hash=encode(sha256(convert_to(shared_terms::text,'UTF8')),'hex'),frozen_text=outgoing,status='awaiting_client',sent_at=clock_timestamp(),version=version+1 where proposal_id=r.proposal_id and revision=r.revision returning * into r;
  elsif p_action in ('replace','withdraw') then
   if r.status not in ('awaiting_client','draft','declined','changes_requested','expired') then raise exception 'This proposal cannot be replaced or withdrawn';end if;
   update automation_outbox set state='cancelled',updated_at=clock_timestamp() where project_id=p.id and purpose='proposal:'||r.proposal_id::text||':r'||r.revision and state='queued';
   update proposal_revisions set status=case when p_action='replace' then 'superseded' else 'withdrawn' end,version=version+1 where proposal_id=r.proposal_id and revision=r.revision returning * into r;
   if p_action='replace' then
    insert into proposal_revisions(proposal_id,revision,project_id,status,shared_terms,expires_at,expected_scope_version,client_sender_id,source_request_id)
     values(r.proposal_id,r.revision+1,p.id,'draft',r.shared_terms,r.expires_at,p.scope_version,p.people->>'client_sender_id',r.source_request_id) returning * into r;
   end if;
  else raise exception 'Unsupported proposal command';end if;
 end if;
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),'proposal:'||p_action,p.version,jsonb_build_object('proposalId',r.proposal_id,'revision',r.revision));
 result:=to_jsonb(r);insert into command_receipts values(auth.uid(),p_key,fingerprint,result);return result;
end $$;
revoke all on function public.owner_proposal_command(uuid,uuid,integer,integer,text,jsonb,text) from public,anon;
grant execute on function public.owner_proposal_command(uuid,uuid,integer,integer,text,jsonb,text) to authenticated;
notify pgrst,'reload schema';
