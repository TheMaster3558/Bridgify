-- Persist owner-visible task and review records. Browser clients can read only
-- records belonging to projects they own; guarded backend commands write them.
create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  task_code text not null check (length(task_code) between 1 and 40),
  title text not null check (length(title) between 1 and 500),
  status text not null default 'ready' check (status in ('ready','in_progress','blocked','done','cancelled')),
  priority text not null default 'normal' check (priority in ('high','normal','low')),
  assignee text not null default '',
  agreed_due_date date,
  origin text not null check (origin in ('auto','agreement','manual','proposal')),
  origin_text text not null default '',
  request_code text,
  blocked_reason text,
  operation text,
  target_id text,
  value text,
  acceptance_criteria text,
  source_text text,
  source_meta text,
  authorized_by text,
  revision_unit text,
  internal_note text,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,task_code)
);

create index project_tasks_owner_list on public.project_tasks(project_id,status,updated_at desc);

create table public.owner_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  decision_code text not null check (length(decision_code) between 1 and 40),
  request_code text not null check (length(request_code) between 1 and 40),
  reason text not null check (reason in ('scope_addition','exhausted_allowance','ambiguous_request','deadline_change','conflicting_request','unknown_participant','unsupported_input','failed_processing','delivery_unknown','policy_denied')),
  title text not null check (length(title) between 1 and 500),
  severity text not null default 'warning' check (severity in ('warning','critical','info')),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  source_text text not null default '',
  source_meta text not null default '',
  evidence text not null default '',
  evidence_source text not null default '',
  explanation text not null default '',
  missing_details jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_details)='array'),
  suggested_options jsonb not null default '[]'::jsonb check (jsonb_typeof(suggested_options)='array'),
  reply_preview text not null default '',
  internal_note text,
  history jsonb not null default '[]'::jsonb check (jsonb_typeof(history)='array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,decision_code)
);

create index owner_decisions_open_list on public.owner_decisions(project_id,status,updated_at desc);

alter table public.project_tasks enable row level security;
alter table public.owner_decisions enable row level security;

create policy owner_read on public.project_tasks
  for select to authenticated using (public.owns_project(project_id));
create policy owner_read on public.owner_decisions
  for select to authenticated using (public.owns_project(project_id));

revoke all on public.project_tasks,public.owner_decisions from public,anon,authenticated;
grant select on public.project_tasks,public.owner_decisions to authenticated;
grant all on public.project_tasks,public.owner_decisions to service_role;
