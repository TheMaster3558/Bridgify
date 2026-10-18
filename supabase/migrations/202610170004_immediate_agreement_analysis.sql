-- Interactive agreement analysis uses the same persisted source, lease and finish guards.
alter table public.jobs add column execution_mode text not null default 'background'
 check(execution_mode in ('background','interactive'));

alter function public.onboarding_command(uuid,integer,text,jsonb,text) rename to onboarding_command_v2;
revoke all on function public.onboarding_command_v2(uuid,integer,text,jsonb,text) from public,anon,authenticated;
create function public.onboarding_command(p_project uuid,p_expected integer,p_section text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; did uuid;
begin
 result:=onboarding_command_v2(p_project,p_expected,p_section,p_payload,p_key);
 if p_section in ('document','agreement_retry') and p_payload->>'processing_mode'='interactive' then
  did:=case when p_section='document' then (result->>'documentId')::uuid else (p_payload->>'document_id')::uuid end;
  update jobs set execution_mode='interactive' where document_id=did and status='pending';
 end if;
 return result;
end $$;
revoke all on function public.onboarding_command(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.onboarding_command(uuid,integer,text,jsonb,text) to authenticated,service_role;

create or replace function public.claim_document_job() returns jsonb language plpgsql security definer set search_path=public as $$
declare j jobs;
begin
 select * into j from jobs where execution_mode='background' and ((status='pending' and available_at<=now()) or (status='processing' and lease_until<now())) order by available_at for update skip locked limit 1;
 if not found then return null; end if;
 update jobs set status='processing',attempts=attempts+1,lease_until=now()+interval '60 seconds',lease_token=gen_random_uuid() where id=j.id returning * into j;
 update documents set status='processing',error=null where id=j.document_id;
 return to_jsonb(j);
end $$;

create function public.claim_agreement_job(p_project uuid,p_document uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; d documents; j jobs;
begin
 select * into p from projects where id=p_project for update;
 if not found or p.status<>'draft' or p.activation_cutoff is not null or p.current_agreement_document_id is distinct from p_document then return null; end if;
 select * into d from documents where id=p_document and project_id=p.id;
 if not found or d.status not in ('queued','processing') then return null; end if;
 select * into j from jobs where document_id=d.id for update;
 if not found or not (j.status='pending' or (j.status='processing' and j.lease_until<now())) then return null; end if;
 update jobs set execution_mode='interactive',status='processing',attempts=attempts+1,lease_until=now()+interval '90 seconds',lease_token=gen_random_uuid() where id=j.id returning * into j;
 update documents set status='processing',error=null where id=d.id;
 return to_jsonb(j);
end $$;

create function public.finish_agreement_attempt(p_job uuid,p_lease uuid,p_spans jsonb,p_extraction jsonb,p_error text,p_unsupported boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
declare did uuid; pid uuid; accepted boolean;
begin
 select d.id,d.project_id into did,pid from documents d join jobs j on j.document_id=d.id where j.id=p_job;
 if pid is null then return false; end if;
 perform 1 from projects where id=pid for update;
 accepted:=finish_document_job(p_job,p_lease,p_spans,p_extraction,p_error,p_unsupported);
 if accepted and p_error is not null then
  -- One click is one bounded attempt. The UI offers retry; no hidden worker backoff.
  update documents set status=case when p_unsupported then 'unsupported' else 'failed' end where id=did;
  update jobs set status='failed',lease_until=null,lease_token=null where id=p_job;
 end if;
 return accepted;
end $$;
revoke all on function public.claim_agreement_job(uuid,uuid),public.finish_agreement_attempt(uuid,uuid,jsonb,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_agreement_job(uuid,uuid),public.finish_agreement_attempt(uuid,uuid,jsonb,jsonb,text,boolean) to service_role;
