-- Forward-only fix: automation data belongs to its project, just like tasks and decisions.
-- Do not replay migration 010 or remove foreign-key integrity checks.
alter table public.automation_events drop constraint automation_events_project_id_fkey;
alter table public.automation_events add constraint automation_events_project_id_fkey foreign key(project_id) references public.projects on delete cascade;
alter table public.automation_messages drop constraint automation_messages_project_id_fkey;
alter table public.automation_messages add constraint automation_messages_project_id_fkey foreign key(project_id) references public.projects on delete cascade;
alter table public.automation_jobs drop constraint automation_jobs_project_id_fkey;
alter table public.automation_jobs add constraint automation_jobs_project_id_fkey foreign key(project_id) references public.projects on delete cascade;
alter table public.automation_requests drop constraint automation_requests_project_id_fkey;
alter table public.automation_requests add constraint automation_requests_project_id_fkey foreign key(project_id) references public.projects on delete cascade;
alter table public.automation_revision_uses drop constraint automation_revision_uses_project_id_fkey;
alter table public.automation_revision_uses add constraint automation_revision_uses_project_id_fkey foreign key(project_id) references public.projects on delete cascade;
alter table public.automation_outbox drop constraint automation_outbox_project_id_fkey;
alter table public.automation_outbox add constraint automation_outbox_project_id_fkey foreign key(project_id) references public.projects on delete cascade;

create or replace function public.delete_project(p_project uuid, p_name text)
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
   or exists(select 1 from command_receipts where result->>'projectId'=p.id::text and result->>'state'='sending')
   or exists(select 1 from automation_outbox where project_id=p.id and state='sending') then
   raise exception 'A message send is still in progress. Wait for it to finish or check its delivery status before deleting this project' using errcode='22023';
 end if;
 insert into project_deletion_cleanup(project_id,owner_id,storage_paths)
 select p.id,auth.uid(),coalesce(jsonb_agg(storage_path) filter(where storage_path is not null),'[]'::jsonb) from documents where project_id=p.id;
 -- Remove command responses while the referenced task/decision IDs still exist.
 delete from command_receipts where result->'project'->>'id'=p.id::text or result->>'projectId'=p.id::text
   or result->>'project_id'=p.id::text
   or result->>'decisionId' in(select id::text from owner_decisions where project_id=p.id)
   or result->>'taskId' in(select id::text from project_tasks where project_id=p.id);
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
 -- Work, decisions and automation records cascade together in this statement.
 -- This also resolves their circular request/task/decision foreign keys.
 delete from projects where id=p.id;
 return jsonb_build_object('deleted',true,'projectId',p.id);
end $$;
revoke all on function public.delete_project(uuid,text) from public,anon;
grant execute on function public.delete_project(uuid,text) to authenticated;
