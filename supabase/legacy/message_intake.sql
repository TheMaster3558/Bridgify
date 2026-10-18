-- Initial shared identity and intake tables. No demo records or automatic work.
create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null,
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations(id), user_id uuid not null,
  role text not null check (role in ('owner','teammate')),
  primary key (organization_id,user_id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id), name text not null,
  status text not null default 'draft' check (status in ('draft','active','paused','review_only','completed','archived')),
  activated_at timestamptz, created_at timestamptz not null default now(),
  unique(id,organization_id), check(status <> 'active' or activated_at is not null)
);
create table public.project_members (
  project_id uuid not null, organization_id uuid not null, user_id uuid not null,
  role text not null check (role in ('owner','requester','approver','teammate')),
  primary key(project_id,user_id,role),
  foreign key(project_id,organization_id) references public.projects(id,organization_id)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, organization_id uuid not null,
  provider_instance_id text not null, chat_guid text not null,
  type text not null default 'client_group' check(type in ('client_group','owner_private')),
  active boolean not null default false, verified_at timestamptz,
  identity_hold boolean not null default false,
  input_version bigint not null default 0 check(input_version>=0),
  foreign key(project_id,organization_id) references public.projects(id,organization_id),
  unique(id,project_id,organization_id), check(not active or verified_at is not null)
);
create unique index conversations_active_provider_chat on public.conversations(provider_instance_id,chat_guid) where active;
create unique index conversations_one_active_client_group on public.conversations(project_id) where active and type='client_group';
create table public.participant_bindings (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null,
  project_id uuid not null, organization_id uuid not null, provider_sender_id text not null,
  user_id uuid, authority text not null check(authority in ('requester','owner','bot','viewer')),
  verified_at timestamptz not null, revoked_at timestamptz,
  foreign key(conversation_id,project_id,organization_id) references public.conversations(id,project_id,organization_id),
  check(authority in ('bot','viewer') or user_id is not null)
);
create unique index participant_bindings_current on public.participant_bindings(conversation_id,provider_sender_id) where revoked_at is null;

create table public.inbox_events (
  id uuid primary key default gen_random_uuid(), provider_instance_id text not null,
  event_key text not null, fingerprint text not null, chat_guid text not null,
  provider_message_guid text, provider_sender_id text, provider_occurred_at timestamptz,
  project_id uuid, organization_id uuid, conversation_id uuid,
  kind text not null check(kind in ('message','edit','delete','membership','delivery')),
  state text not null default 'received', received_at timestamptz not null default now(),
  unique(provider_instance_id,event_key),
  unique(id,project_id,organization_id),
  foreign key(conversation_id,project_id,organization_id) references public.conversations(id,project_id,organization_id),
  check ((conversation_id is null and project_id is null and organization_id is null) or
         (conversation_id is not null and project_id is not null and organization_id is not null))
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null,
  project_id uuid not null, organization_id uuid not null, provider_message_guid text not null,
  provider_sender_id text, sender_role text not null check(sender_role in ('requester','owner','bot','viewer','unknown')),
  direction text not null check(direction in ('inbound','outbound')),
  created_at timestamptz not null default now(),
  foreign key(conversation_id,project_id,organization_id) references public.conversations(id,project_id,organization_id),
  unique(conversation_id,provider_message_guid), unique(id,project_id,organization_id)
);
create table public.message_revisions (
  id uuid primary key default gen_random_uuid(), message_id uuid not null,
  project_id uuid not null, organization_id uuid not null,
  source_event_id uuid not null,
  revision integer not null check(revision>0), fingerprint text not null,
  kind text not null check(kind in ('message','edit','delete')),
  text text check(length(text)<=30000), deleted boolean not null default false,
  provider_occurred_at timestamptz, received_at timestamptz not null default now(),
  provider_sender_id text, sender_role text not null, processing_state text not null,
  foreign key(message_id,project_id,organization_id) references public.messages(id,project_id,organization_id),
  foreign key(source_event_id,project_id,organization_id) references public.inbox_events(id,project_id,organization_id),
  unique(message_id,revision), unique(message_id,fingerprint), unique(id,project_id,organization_id)
);
create index messages_conversation_history on public.messages(conversation_id,created_at,id);
create index revisions_message_history on public.message_revisions(message_id,revision);
create table public.jobs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, organization_id uuid not null,
  type text not null check(type in ('analyze_conversation','review_unknown_participant','review_message_change','review_membership','review_unprocessed_message')),
  inbox_event_id uuid not null, source_message_revision_id uuid,
  state text not null default 'queued' check(state in ('queued','running','done','failed')),
  attempts integer not null default 0 check(attempts>=0), available_at timestamptz not null default now(),
  lease_until timestamptz, error_code text, created_at timestamptz not null default now(),
  foreign key(project_id,organization_id) references public.projects(id,organization_id),
  foreign key(inbox_event_id,project_id,organization_id) references public.inbox_events(id,project_id,organization_id),
  foreign key(source_message_revision_id,project_id,organization_id) references public.message_revisions(id,project_id,organization_id),
  unique(type,inbox_event_id), unique(type,source_message_revision_id)
);
create index jobs_ready on public.jobs(state,available_at);
create index inbox_project_state on public.inbox_events(project_id,state,received_at);

-- Immutable source content. Processing state can change; source evidence cannot.
create function public.protect_message_source() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'message source history is immutable'; end if;
  if (to_jsonb(new) - 'processing_state') is distinct from (to_jsonb(old) - 'processing_state') then
    raise exception 'message source history is immutable';
  end if;
  return new;
end $$;
create trigger immutable_message_source before update or delete on public.message_revisions
  for each row execute function public.protect_message_source();

-- Compatible with Supabase request claims; absent claims grant no access.
create function public.intake_user_id() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid
$$;
create function public.can_read_project_history(target uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.projects p join public.organization_members om on om.organization_id=p.organization_id
    where p.id=target and om.user_id=public.intake_user_id() and
      (om.role='owner' or exists(select 1 from public.project_members pm
        where pm.project_id=p.id and pm.user_id=om.user_id and pm.role in ('owner','teammate')))
  )
$$;
revoke all on function public.can_read_project_history(uuid) from public;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.conversations enable row level security;
alter table public.participant_bindings enable row level security;
alter table public.inbox_events enable row level security;
alter table public.messages enable row level security;
alter table public.message_revisions enable row level security;
alter table public.jobs enable row level security;
create policy project_history_owner on public.projects for select using(public.can_read_project_history(id));
create policy conversation_history_owner on public.conversations for select using(public.can_read_project_history(project_id));
create policy message_history_owner on public.messages for select using(public.can_read_project_history(project_id));
create policy revision_history_owner on public.message_revisions for select using(public.can_read_project_history(project_id));
revoke all on public.organizations,public.organization_members,public.projects,public.project_members,
  public.conversations,public.participant_bindings,public.inbox_events,public.messages,public.message_revisions,public.jobs from public;
-- No browser writes and no access to jobs, private bindings or inbox metadata.
do $$ begin
  if exists(select 1 from pg_roles where rolname='anon') then
    revoke all on public.organizations,public.organization_members,public.projects,public.project_members,
      public.conversations,public.participant_bindings,public.inbox_events,public.messages,public.message_revisions,public.jobs from anon;
  end if;
  if exists(select 1 from pg_roles where rolname='authenticated') then
    revoke all on public.organizations,public.organization_members,public.projects,public.project_members,
      public.conversations,public.participant_bindings,public.inbox_events,public.messages,public.message_revisions,public.jobs from authenticated;
    grant select on public.projects,public.conversations,public.messages,public.message_revisions to authenticated;
    grant execute on function public.can_read_project_history(uuid) to authenticated;
  end if;
end $$;
