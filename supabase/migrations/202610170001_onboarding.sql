-- Apply to an empty Supabase project. No demo owner or public client policies.

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120), created_at timestamptz not null default now());
create table public.organization_members (organization_id uuid references public.organizations on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('owner')), primary key(organization_id,user_id), unique(user_id));
create table public.projects (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 owner_id uuid not null references auth.users, name text not null check(length(name) between 1 and 120), client_name text not null check(length(client_name) between 1 and 120),
 original_amount_cents bigint not null check(original_amount_cents between 0 and 100000000), currency text not null default 'USD' check(currency='USD'), timezone text not null,
 agreed_due_date date, status text not null default 'draft' check(status in ('draft','active','paused','review_only','completed','archived')),
 setup_step integer not null default 2, version integer not null default 1, scope_version integer not null default 0, policy_version integer not null default 0,
 people jsonb, policy jsonb, activation_cutoff timestamptz, disclosure_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.project_members (project_id uuid references public.projects, user_id uuid references auth.users, requester boolean not null default true, approver boolean not null default true, primary key(project_id,user_id));
create table public.documents (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects,
 kind text not null check(kind in ('text','pdf')), storage_path text unique, original_text text,
 status text not null default 'queued' check(status in ('queued','processing','ready','failed','unsupported')),
 extraction jsonb, error text, created_at timestamptz not null default now(), check(original_text is null or length(original_text)<=30000)
);
create table public.document_spans (id uuid primary key, document_id uuid not null references public.documents, page integer not null check(page>0), start_offset integer not null, end_offset integer not null, text text not null, check(end_offset>start_offset));
create table public.scope_versions (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, version integer not null, document_id uuid not null references public.documents, terms jsonb not null, confirmed_by uuid not null references auth.users, confirmed_at timestamptz not null default now(), unique(project_id,version));
create table public.policy_versions (project_id uuid references public.projects, version integer, policy jsonb not null, confirmed_by uuid not null references auth.users, created_at timestamptz not null default now(), primary key(project_id,version));
-- Private proposal revision table. Client reads go exclusively through shared_proposal().
create table public.proposal_revisions (proposal_id uuid not null, revision integer not null check(revision>0), project_id uuid not null references public.projects, designated_approver uuid references auth.users, status text not null default 'draft', shared_terms jsonb not null, internal_notes text, expires_at timestamptz, primary key(proposal_id,revision));
create table public.project_invitations (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects, email text not null, token_hash text not null unique, proposal_id uuid, revision integer, expires_at timestamptz not null default now()+interval '7 days', accepted_by uuid references auth.users, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(), foreign key(proposal_id,revision) references public.proposal_revisions, check((proposal_id is null)=(revision is null)));
create table public.chat_bindings (
 project_id uuid primary key references public.projects, instance_id text not null, chat_guid text not null,
 participants jsonb not null, membership_hash text not null, verified_at timestamptz,
 test_message_guid text, test_state text not null default 'pending' check(test_state in ('pending','sending','sent','unknown','failed')), disclosed_message_guid text,
 webhook_verified_at timestamptz, hold_reason text, unique(instance_id,chat_guid)
);
create table public.jobs (id uuid primary key default gen_random_uuid(), document_id uuid not null unique references public.documents, status text not null default 'pending', attempts integer not null default 0, available_at timestamptz not null default now(), lease_until timestamptz, lease_token uuid);
create table public.audit_events (id uuid primary key default gen_random_uuid(), project_id uuid references public.projects, actor_id uuid references auth.users, action text not null, version integer, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create table public.command_receipts (user_id uuid not null references auth.users, key text not null, fingerprint text not null, result jsonb not null, primary key(user_id,key));
create table public.inbox_events (id uuid primary key default gen_random_uuid(), instance_id text not null, event_key text not null, project_id uuid not null references public.projects, payload jsonb not null, disposition text not null, received_at timestamptz not null default now(), unique(instance_id,event_key));
create index projects_org_updated on public.projects(organization_id,updated_at desc);
create index documents_project on public.documents(project_id,created_at desc);
create index jobs_available on public.jobs(status,available_at);

create function public.is_owner(org uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from organization_members where organization_id=org and user_id=auth.uid() and role='owner') $$;
create function public.owns_project(pid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from projects where id=pid and public.is_owner(organization_id)) $$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.documents enable row level security;
alter table public.document_spans enable row level security;
alter table public.scope_versions enable row level security;
alter table public.policy_versions enable row level security;
alter table public.proposal_revisions enable row level security;
alter table public.project_invitations enable row level security;
alter table public.chat_bindings enable row level security;
alter table public.jobs enable row level security;
alter table public.audit_events enable row level security;
alter table public.command_receipts enable row level security;
alter table public.inbox_events enable row level security;
create policy owner_read on public.organizations for select to authenticated using(public.is_owner(id));
create policy own_membership on public.organization_members for select to authenticated using(user_id=auth.uid());
create policy owner_read on public.projects for select to authenticated using(public.is_owner(organization_id));
create policy owner_read on public.project_members for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.documents for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.document_spans for select to authenticated using(exists(select 1 from documents d where d.id=document_id and public.owns_project(d.project_id)));
create policy owner_read on public.scope_versions for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.policy_versions for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.proposal_revisions for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.project_invitations for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.chat_bindings for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.audit_events for select to authenticated using(public.owns_project(project_id));
create policy owner_read on public.inbox_events for select to authenticated using(public.owns_project(project_id));
-- No authenticated INSERT/UPDATE/DELETE grants: all writes are guarded commands.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.organizations, public.organization_members, public.projects, public.project_members, public.documents, public.document_spans, public.scope_versions, public.policy_versions, public.proposal_revisions, public.project_invitations, public.chat_bindings, public.audit_events, public.inbox_events to authenticated;
grant all on all tables in schema public to service_role;

create function public.create_workspace(p_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare oid uuid;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select organization_id into oid from organization_members where user_id=auth.uid();
 if oid is not null then return oid; end if;
 if length(trim(p_name)) not between 1 and 120 then raise exception 'Enter a workspace name'; end if;
 insert into organizations(name) values(trim(p_name)) returning id into oid;
 insert into organization_members values(oid,auth.uid(),'owner');
 return oid;
end $$;

create function public.onboarding_command(p_project uuid, p_expected integer, p_section text, p_payload jsonb, p_key text) returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; oid uuid; result jsonb; fingerprint text; prior command_receipts; d documents; term jsonb; token text; binding chat_bindings; next_status text;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_section is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'A setup command object is required'; end if;
 if p_key is null or length(p_key) not between 16 and 100 then raise exception 'Idempotency key required'; end if;
 fingerprint := md5(coalesce(p_project::text,'')||coalesce(p_expected::text,'')||p_section||p_payload::text);
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
   if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused with different input' using errcode='40001'; end if;
   return prior.result;
 end if;
 if p_project is null then
  if p_section<>'basics' then raise exception 'Create project basics first'; end if;
  select organization_id into oid from organization_members where user_id=auth.uid() and role='owner';
  if oid is null then raise insufficient_privilege; end if;
  insert into projects(organization_id,owner_id,name,client_name,original_amount_cents,currency,timezone,agreed_due_date)
  values(oid,auth.uid(),p_payload->>'name',p_payload->>'client_name',(p_payload->>'original_amount_cents')::bigint,p_payload->>'currency',p_payload->>'timezone',(p_payload->>'agreed_due_date')::date) returning * into p;
 else
  select * into p from projects where id=p_project for update;
  if not found or not public.is_owner(p.organization_id) then raise insufficient_privilege; end if;
  if p.version is distinct from p_expected then raise exception 'Project changed; refresh before retrying' using errcode='40001'; end if;
  if exists(select 1 from chat_bindings where project_id=p.id and test_state='sending') then raise exception 'Wait for the connection test to finish before changing setup'; end if;
  if p_section in ('basics','scope','people','policy','document','invite') and (p.activation_cutoff is not null or p.status in ('completed','archived')) then raise exception 'Activated or closed setup is immutable. Material changes require an approved amendment; history is retained.'; end if;
  if p_section='basics' then
   update projects set name=p_payload->>'name',client_name=p_payload->>'client_name',original_amount_cents=(p_payload->>'original_amount_cents')::bigint,currency=p_payload->>'currency',timezone=p_payload->>'timezone',agreed_due_date=(p_payload->>'agreed_due_date')::date where id=p.id;
  elsif p_section='document' then
   if p_payload->>'kind' not in ('text','pdf') then raise exception 'Unsupported agreement type'; end if;
   if p_payload->>'kind'='text' and length(trim(coalesce(p_payload->>'text',''))) not between 1 and 30000 then raise exception 'Agreement must contain 1–30,000 characters'; end if;
   if p_payload->>'kind'='pdf' and (p_payload->>'storage_path' not like p.id::text||'/%' or p_payload->>'storage_path' is null) then raise exception 'Invalid private document path'; end if;
   insert into documents(project_id,kind,original_text,storage_path) values(p.id,p_payload->>'kind',p_payload->>'text',p_payload->>'storage_path') returning * into d;
   insert into jobs(document_id) values(d.id);
   -- A replacement agreement invalidates the draft baseline, without deleting earlier evidence.
   update projects set scope_version=0,policy_version=0,policy=null,setup_step=2 where id=p.id;
  elsif p_section='scope' then
   select * into d from documents where id=(p_payload->>'document_id')::uuid and project_id=p.id and status='ready';
   if not found or (p_payload->>'reviewed_all_terms')::boolean is distinct from true then raise exception 'Review the complete extracted agreement first'; end if;
   if d.id<>(select id from documents where project_id=p.id order by created_at desc,id desc limit 1) then raise exception 'Confirm the most recent agreement'; end if;
   if jsonb_typeof(p_payload->'terms')<>'array' or jsonb_array_length(p_payload->'terms') not between 1 and 100 then raise exception 'Confirm 1–100 terms'; end if;
   if not exists(select 1 from jsonb_array_elements(p_payload->'terms') t where t->>'kind'='inclusion') then raise exception 'At least one included scope item is required'; end if;
   for term in select * from jsonb_array_elements(p_payload->'terms') loop
    if term->>'kind' not in ('inclusion','exclusion','revision','date','responsibility') or length(trim(coalesce(term->>'text',''))) not between 1 and 2000 or length(coalesce(term->>'quote',''))=0 then raise exception 'Invalid confirmed term'; end if;
    if not exists(select 1 from document_spans s where s.id=(term->>'span_id')::uuid and s.document_id=d.id and position(term->>'quote' in s.text)>0) then raise exception 'Each term needs a valid source quotation'; end if;
   end loop;
   insert into scope_versions(project_id,version,document_id,terms,confirmed_by) values(p.id,(select coalesce(max(version),0)+1 from scope_versions where project_id=p.id),d.id,p_payload->'terms',auth.uid()) returning version into p.scope_version;
   update projects set scope_version=p.scope_version,policy_version=0,policy=null,setup_step=3 where id=p.id;
  elsif p_section='invite' then
   if length(p_payload->>'email') not between 3 and 254 or p_payload->>'email' not like '%@%' then raise exception 'Valid email required'; end if;
   if lower(p_payload->>'email')=(select lower(email) from auth.users where id=auth.uid()) then raise exception 'Invite a separate client identity'; end if;
   if p_payload->>'proposal_id' is not null and not exists(select 1 from proposal_revisions where proposal_id=(p_payload->>'proposal_id')::uuid and revision=(p_payload->>'revision')::integer and project_id=p.id) then raise exception 'Proposal is unavailable'; end if;
   update project_invitations set revoked_at=now() where project_id=p.id and revoked_at is null;
   delete from project_members where project_id=p.id;
   delete from chat_bindings where project_id=p.id;
   update projects set people=null where id=p.id;
   token := replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
   insert into project_invitations(project_id,email,token_hash,proposal_id,revision) values(p.id,lower(p_payload->>'email'),encode(sha256(convert_to(token,'UTF8')),'hex'),(p_payload->>'proposal_id')::uuid,(p_payload->>'revision')::integer);
  elsif p_section='people' then
   if (p_payload->>'identities_confirmed')::boolean is distinct from true or length(coalesce(p_payload->>'instance_id',''))=0 or length(coalesce(p_payload->>'chat_guid',''))=0 then raise exception 'Confirm exact group and identities'; end if;
   if (select count(distinct v) from (values(p_payload->>'owner_sender_id'),(p_payload->>'client_sender_id'),(p_payload->>'bot_sender_id')) ids(v) where length(v)>0)<>3 then raise exception 'Three distinct sender identities are required'; end if;
   if not exists(select 1 from project_members where project_id=p.id and requester and approver) then raise exception 'Client must accept the invitation before identity mapping'; end if;
   delete from chat_bindings where project_id=p.id;
   update projects set people=p_payload||jsonb_build_object('client_user_id',(select user_id from project_members where project_id=p.id limit 1),'owner_user_id',auth.uid()),setup_step=4 where id=p.id;
  elsif p_section='policy' then
   if not (p_payload ?& array['mode','allowance_mode','allowance','operations','targets','exclusions','max_open_tasks','notifications']) or exists(select 1 from jsonb_each(p_payload) where value='null'::jsonb) then raise exception 'Complete automation settings are required'; end if;
   if p_payload->>'mode' not in ('enabled','review_only') or p_payload->>'allowance_mode' not in ('per_request','manual_rounds') or (p_payload->>'allowance')::integer not between 0 and 10000 or (p_payload->>'max_open_tasks')::integer not between 1 and 10 or p_payload->>'notifications'<>'dashboard' then raise exception 'Invalid automation settings'; end if;
   if jsonb_array_length(p_payload->'targets') not between 1 and 30 or length(trim(p_payload->>'exclusions'))=0 then raise exception 'Targets and exclusions required'; end if;
   if exists(select 1 from jsonb_array_elements_text(p_payload->'operations') op where op not in ('replace_text','change_color')) then raise exception 'Unsupported operation'; end if;
   if p_payload->>'mode'='enabled' and (p_payload->>'allowance_mode'<>'per_request' or (p_payload->>'allowance')::integer<1 or jsonb_array_length(p_payload->'operations')<1) then raise exception 'Automatic work requires a per-request allowance'; end if;
   if p_payload->>'mode'='enabled' and exists(select 1 from scope_versions s, jsonb_array_elements(s.terms) t where s.project_id=p.id and s.version=p.scope_version and t->>'kind'='revision' and ((t->>'text')||' '||(t->>'quote')) ~* '\mrounds?\M') then raise exception 'Agreement describes revision rounds; use review-only mode'; end if;
   select coalesce(max(version),0)+1 into p.policy_version from policy_versions where project_id=p.id;
   insert into policy_versions values(p.id,p.policy_version,p_payload,auth.uid(),now());
   update projects set policy=p_payload,policy_version=p.policy_version,setup_step=5 where id=p.id;
  elsif p_section='lifecycle' then
   next_status := p_payload->>'status';
   if length(trim(coalesce(p_payload->>'reason','')))<3 then raise exception 'A lifecycle reason is required'; end if;
   if next_status not in ('active','paused','review_only','completed','archived') then raise exception 'Invalid lifecycle state'; end if;
   if p.status='archived' or (p.status='completed' and next_status<>'archived') then raise exception 'Closed projects cannot accept more work'; end if;
   if p.status='draft' and next_status not in ('active','review_only','archived') then raise exception 'Finish setup before pausing or completing'; end if;
   if next_status in ('active','review_only') then
    select * into binding from chat_bindings where project_id=p.id;
    if p.scope_version=0 or p.policy_version=0 or p.people is null then raise exception 'Confirm scope, participants and automation first'; end if;
    if not exists(select 1 from project_members where project_id=p.id and requester and approver) then raise exception 'Invited client must authenticate and accept'; end if;
    if binding.verified_at is null or binding.test_state<>'sent' or binding.webhook_verified_at is null or binding.disclosed_message_guid is null or binding.hold_reason is not null then raise exception 'A verified group, test send, verified webhook and assistant disclosure are required'; end if;
    if p.activation_cutoff is null and (p_payload->>'disclosed')::boolean is distinct from true then raise exception 'Confirm all participants agreed to assistant processing'; end if;
    if next_status='active' and p.policy->>'mode'<>'enabled' then raise exception 'Choose review-only for this policy'; end if;
    update projects set activation_cutoff=clock_timestamp(),disclosure_at=coalesce(disclosure_at,now()) where id=p.id;
   end if;
   update projects set status=next_status where id=p.id;
  else raise exception 'Unsupported setup command'; end if;
  update projects set version=version+1,updated_at=now() where id=p.id returning * into p;
 end if;
 if not exists(select 1 from pg_timezone_names where name=p.timezone) then raise exception 'Invalid project timezone'; end if;
 insert into audit_events(project_id,actor_id,action,version,details) values(p.id,auth.uid(),p_section||case when p_section='lifecycle' then ':'||next_status else '' end,p.version,case when p_section='lifecycle' then jsonb_build_object('reason',p_payload->>'reason') else '{}'::jsonb end);
 result := jsonb_build_object('project',to_jsonb(p),'documentId',d.id,'invitationToken',token);
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;

create function public.accept_invitation(p_token text) returns text language plpgsql security definer set search_path=public as $$
declare invite project_invitations; verified_email text; path text;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select lower(email) into verified_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
 perform 1 from projects where id=(select project_id from project_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) for update;
 select * into invite from project_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or invite.revoked_at is not null or (invite.accepted_by is null and invite.expires_at<=now()) or verified_email is distinct from invite.email or (invite.accepted_by is not null and invite.accepted_by<>auth.uid()) then raise exception 'Invitation unavailable. Sign in with the invited email or ask the owner for a new invitation.'; end if;
 -- Lock against owner replacing the invitation while it is being accepted.
 perform 1 from projects where id=invite.project_id for update;
 insert into project_members values(invite.project_id,auth.uid(),true,true) on conflict do nothing;
 update project_invitations set accepted_by=auth.uid(),accepted_at=coalesce(accepted_at,now()) where id=invite.id;
 if invite.proposal_id is not null then
  update proposal_revisions set designated_approver=auth.uid() where proposal_id=invite.proposal_id and revision=invite.revision and project_id=invite.project_id and (designated_approver is null or designated_approver=auth.uid());
  if not found then raise exception 'Invitation unavailable. Request access from the owner.'; end if;
  path := '/proposals/'||invite.proposal_id||'?revision='||invite.revision;
 else path := '/access'; end if;
 return path;
end $$;

create function public.shared_proposal(p_proposal uuid,p_revision integer) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
 select jsonb_build_object('proposal_id',r.proposal_id,'revision',r.revision,'status',r.status,'terms',r.shared_terms,'expires_at',r.expires_at,'project',p.name) into result
 from proposal_revisions r join projects p on p.id=r.project_id join project_members m on m.project_id=p.id and m.user_id=auth.uid() and m.approver
 where r.proposal_id=p_proposal and r.revision=p_revision and r.designated_approver=auth.uid() and r.status<>'draft';
 if result is null then raise insufficient_privilege; end if;
 return result;
end $$;

create function public.claim_document_job() returns jsonb language plpgsql security definer set search_path=public as $$
declare j jobs;
begin
 select * into j from jobs where (status='pending' and available_at<=now()) or (status='processing' and lease_until<now()) order by available_at for update skip locked limit 1;
 if not found then return null; end if;
 update jobs set status='processing',attempts=attempts+1,lease_until=now()+interval '60 seconds',lease_token=gen_random_uuid() where id=j.id returning * into j;
 update documents set status='processing',error=null where id=j.document_id;
 return to_jsonb(j);
end $$;
create function public.finish_document_job(p_job uuid,p_lease uuid,p_spans jsonb,p_extraction jsonb,p_error text,p_unsupported boolean default false) returns boolean language plpgsql security definer set search_path=public as $$
declare j jobs; span jsonb;
begin
 select * into j from jobs where id=p_job and lease_token=p_lease and status='processing' and lease_until>now() for update;
 if not found then return false; end if;
 if p_error is null then
  delete from document_spans where document_id=j.document_id;
  for span in select * from jsonb_array_elements(p_spans) loop
   insert into document_spans values((span->>'id')::uuid,j.document_id,(span->>'page')::integer,(span->>'start_offset')::integer,(span->>'end_offset')::integer,span->>'text');
  end loop;
  update documents set status='ready',extraction=p_extraction,error=null where id=j.document_id;
  update jobs set status='done',lease_until=null where id=j.id;
 else
  update documents set status=case when p_unsupported then 'unsupported' when j.attempts>=3 then 'failed' else 'queued' end,error=p_error where id=j.document_id;
  update jobs set status=case when p_unsupported or attempts>=3 then 'failed' else 'pending' end,available_at=now()+make_interval(secs=>case j.attempts when 1 then 5 when 2 then 30 else 120 end),lease_until=null where id=j.id;
 end if;
 return true;
end $$;

-- No function is executable merely because it exists.
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.is_owner(uuid),public.owns_project(uuid),public.create_workspace(text),public.onboarding_command(uuid,integer,text,jsonb,text),public.accept_invitation(text),public.shared_proposal(uuid,integer) to authenticated;
grant execute on all functions in schema public to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('agreements','agreements',false,5242880,array['application/pdf']) on conflict(id) do nothing;
-- The server uploads after owner authorization. Browser access is read-only and RLS scoped.
create policy agreement_owner_read on storage.objects for select to authenticated using(bucket_id='agreements' and exists(select 1 from public.documents d where d.storage_path=name and public.owns_project(d.project_id)));

create function public.begin_chat_test(p_project uuid,p_expected integer,p_participants jsonb,p_hash text) returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; b chat_bindings;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into p from projects where id=p_project for update;
 if not found or not public.is_owner(p.organization_id) then raise insufficient_privilege; end if;
 if p.version is distinct from p_expected then raise exception 'Project changed; refresh' using errcode='40001'; end if;
 if p.status not in ('draft','paused','review_only') or p.people is null then raise exception 'Save participants; pause an active project before verification'; end if;
 select * into b from chat_bindings where project_id=p.id;
 if b.test_state in ('sending','unknown') then raise exception 'Test delivery is pending or unknown. Inspect the provider before retrying.'; end if;
 insert into chat_bindings(project_id,instance_id,chat_guid,participants,membership_hash,test_state)
 values(p.id,p.people->>'instance_id',p.people->>'chat_guid',p_participants,p_hash,'sending')
 on conflict(project_id) do update set participants=excluded.participants,membership_hash=excluded.membership_hash,test_state='sending',verified_at=null,webhook_verified_at=null,hold_reason=null;
 return jsonb_build_object('project',to_jsonb(p));
end $$;
revoke all on function public.begin_chat_test(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.begin_chat_test(uuid,integer,jsonb,text) to authenticated;

create function public.receive_onboarding_event(p_event jsonb,p_membership_hash text) returns text language plpgsql security definer set search_path=public as $$
declare p projects; b chat_bindings; disposition text; sender text;
begin
 select project_id into p.id from chat_bindings where instance_id=p_event->>'instanceId' and chat_guid=p_event->>'chatGuid';
 if not found then return 'unlinked'; end if;
 select * into p from projects where id=p.id for update;
 select * into b from chat_bindings where project_id=p.id for update;
 if exists(select 1 from inbox_events where instance_id=b.instance_id and event_key=p_event->>'eventKey') then return 'duplicate'; end if;
 sender:=p_event->>'senderId';
 if p_event->>'kind'='membership' or b.membership_hash<>p_membership_hash then
  update chat_bindings set verified_at=null,hold_reason='Membership changed; owner verification required' where project_id=p.id;
  update projects set status=case when status='active' then 'paused' else status end,version=version+1 where id=p.id;
  disposition:='membership_review';
 elsif sender=p.people->>'bot_sender_id' then
  if b.test_state='sending' then raise exception 'Test send is still being recorded; retry this event'; end if;
  if p_event->>'messageGuid'=b.test_message_guid and b.test_state='sent' then update chat_bindings set verified_at=now(),webhook_verified_at=now(),hold_reason=null where project_id=p.id; end if;
  disposition:='bot_echo';
 elsif sender=p.people->>'owner_sender_id' then disposition:='owner_message';
 elsif sender is distinct from p.people->>'client_sender_id' then
  update chat_bindings set verified_at=null,hold_reason='Unknown sender; owner verification required' where project_id=p.id;
  update projects set status=case when status='active' then 'paused' else status end,version=version+1 where id=p.id;
  disposition:='unknown_sender';
 elsif p.status in ('completed','archived') then disposition:='closed';
 elsif p_event->>'kind'<>'message' then disposition:='review';
 elsif p.activation_cutoff is null or (p_event->>'occurredAt')::timestamptz is null or (p_event->>'occurredAt')::timestamptz<=p.activation_cutoff then disposition:='before_cutoff';
 elsif p.status<>'active' or p.policy->>'mode'<>'enabled' or b.verified_at is null or b.hold_reason is not null then disposition:='review_only';
 elsif not exists(select 1 from project_members where project_id=p.id and user_id=(p.people->>'client_user_id')::uuid and requester) then disposition:='identity_review';
 else disposition:='eligible_intake'; end if;
 insert into inbox_events(instance_id,event_key,project_id,payload,disposition) values(b.instance_id,p_event->>'eventKey',p.id,p_event,disposition);
 return disposition;
end $$;
revoke all on function public.receive_onboarding_event(jsonb,text) from public,anon,authenticated;
grant execute on function public.receive_onboarding_event(jsonb,text) to service_role;
