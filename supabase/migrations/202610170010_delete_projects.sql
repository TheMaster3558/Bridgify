-- Retain only a private cleanup receipt after deleting a project. Storage files
-- must be removed through the Storage API, never by deleting storage.objects.
create table public.project_deletion_cleanup (
 project_id uuid primary key,
 owner_id uuid not null references auth.users,
 storage_paths jsonb not null check(jsonb_typeof(storage_paths)='array'),
 status text not null default 'pending' check(status in ('pending','done')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index project_deletion_cleanup_pending on public.project_deletion_cleanup(updated_at) where status='pending';
alter table public.project_deletion_cleanup enable row level security;
create policy own_cleanup_receipt on public.project_deletion_cleanup for select to authenticated using(owner_id=auth.uid());
grant select on public.project_deletion_cleanup to authenticated;
grant all on public.project_deletion_cleanup to service_role;

create function public.delete_project(p_project uuid, p_name text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; cleanup project_deletion_cleanup;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into p from projects where id=p_project for update;
 if not found then
  select * into cleanup from project_deletion_cleanup where project_id=p_project and owner_id=auth.uid();
  if not found then raise insufficient_privilege; end if;
  return jsonb_build_object('deleted',true,'projectId',p_project);
 end if;
 if not is_owner(p.organization_id) then raise insufficient_privilege; end if;
 if p_name is distinct from p.name then raise exception 'Type the exact project name to confirm deletion' using errcode='22023'; end if;
 if exists(select 1 from chat_bindings where project_id=p.id and test_state='sending')
   or exists(select 1 from command_receipts where result->>'projectId'=p.id::text and result->>'state'='sending') then
   raise exception 'A message send is still in progress. Check its status before deleting this project' using errcode='22023';
 end if;
 insert into project_deletion_cleanup(project_id,owner_id,storage_paths)
 select p.id,auth.uid(),coalesce(jsonb_agg(storage_path) filter(where storage_path is not null),'[]'::jsonb) from documents where project_id=p.id;
 -- Break the project -> current document -> project cycle first.
 update projects set current_agreement_document_id=null where id=p.id;
 delete from project_invitations where project_id=p.id;
 delete from proposal_revisions where project_id=p.id;
 delete from scope_versions where project_id=p.id;
 delete from policy_versions where project_id=p.id;
 delete from chat_bindings where project_id=p.id;
 delete from project_members where project_id=p.id;
 delete from inbox_events where project_id=p.id;
 delete from audit_events where project_id=p.id;
 delete from jobs where document_id in(select id from documents where project_id=p.id);
 delete from document_spans where document_id in(select id from documents where project_id=p.id);
 delete from documents where project_id=p.id;
 delete from command_receipts where result->'project'->>'id'=p.id::text or result->>'projectId'=p.id::text;
 -- Work and decision records use ON DELETE CASCADE (migration 007).
 delete from projects where id=p.id;
 return jsonb_build_object('deleted',true,'projectId',p.id);
end $$;
revoke all on function public.delete_project(uuid,text) from public,anon;
grant execute on function public.delete_project(uuid,text) to authenticated;
