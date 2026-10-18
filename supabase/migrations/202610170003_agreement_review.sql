-- Extend the existing onboarding commands; keep invitations, policies and activation intact.
alter table public.projects add column current_agreement_document_id uuid references public.documents;
alter table public.projects drop constraint projects_currency_check;
alter table public.projects add constraint projects_currency_check check(currency ~ '^[A-Z]{3}$');
alter table public.documents add column review_draft jsonb, add column review_version integer not null default 0;
alter table public.scope_versions add column agreement jsonb;

alter function public.onboarding_command(uuid,integer,text,jsonb,text) rename to onboarding_command_v1;
revoke all on function public.onboarding_command_v1(uuid,integer,text,jsonb,text) from public,anon,authenticated;
create function public.onboarding_command(p_project uuid,p_expected integer,p_section text,p_payload jsonb,p_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
<<cmd>>
declare p projects; d documents; prior command_receipts; fingerprint text; result jsonb; review jsonb; field jsonb; issue jsonb; price jsonb; due jsonb; revision jsonb;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 if p_project is null then return onboarding_command_v1(p_project,p_expected,p_section,p_payload,p_key); end if;
 if p_section is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or p_key is null or length(p_key) not between 16 and 100 then raise exception 'Valid command and idempotency key required'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text||p_key));
 select * into p from projects where id=p_project for update;
 if not found or not is_owner(p.organization_id) then raise insufficient_privilege; end if;
 fingerprint:=md5(p_project::text||coalesce(p_expected::text,'')||p_section||p_payload::text);
 select * into prior from command_receipts where user_id=auth.uid() and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'Idempotency key reused with different input' using errcode='40001'; end if;
  return prior.result;
 end if;
 if p.version is distinct from p_expected then raise exception 'Project changed; refresh before retrying' using errcode='40001'; end if;
 if p_section in ('agreement_review','agreement_retry','scope','document') and (p.status<>'draft' or p.activation_cutoff is not null) then raise exception 'Agreement setup is available only for an unactivated draft project'; end if;
 if p_section in ('agreement_review','agreement_retry','scope') then
  select * into d from documents where id=(p_payload->>'document_id')::uuid and project_id=p.id;
  if not found or (p.current_agreement_document_id is not null and d.id<>p.current_agreement_document_id) then raise exception 'Review the current agreement'; end if;
 end if;
 if p_section='agreement_review' then
  if d.status<>'ready' then raise exception 'Wait for extraction before reviewing'; end if;
  if d.review_version is distinct from (p_payload->>'expectedReviewVersion')::integer then raise exception 'Agreement review changed; refresh before retrying' using errcode='40001'; end if;
  review:=p_payload->'review';
  if jsonb_typeof(review) is distinct from 'object' or jsonb_typeof(review->'terms') is distinct from 'array' or jsonb_array_length(review->'terms')>100 or octet_length(review::text)>250000 then raise exception 'Invalid review draft'; end if;
  update documents set review_draft=review,review_version=review_version+1 where id=d.id returning * into d;
  result:=jsonb_build_object('project',to_jsonb(p),'reviewVersion',d.review_version);
 elsif p_section='agreement_retry' then
  if d.status not in ('failed','unsupported') then raise exception 'Only a failed extraction can be retried'; end if;
  update documents set status='queued',error=null,extraction=null,review_draft=null,review_version=review_version+1 where id=d.id;
  update jobs set status='pending',attempts=0,available_at=now(),lease_until=null,lease_token=null where document_id=d.id;
  result:=jsonb_build_object('project',to_jsonb(p));
 else
  if p_section='scope' and p.current_agreement_document_id is not null then
   review:=p_payload->'review';
   if review is null or jsonb_typeof(review)<>'object' or review->'terms' is distinct from p_payload->'terms' then raise exception 'Confirm the reviewed agreement fields'; end if;
   if exists(select 1 from jsonb_array_elements(p_payload->'terms') t where coalesce(t->>'kind','') not in ('inclusion','exclusion','revision','date','responsibility') or length(trim(coalesce(t->>'text',''))) not between 1 and 2000 or length(coalesce(t->>'quote','')) not between 1 and 4000) then raise exception 'Invalid reviewed term'; end if;
   if jsonb_typeof(review->'issues') is distinct from 'array' then raise exception 'Review every ambiguity'; end if;
   -- Original warnings cannot be removed to bypass review.
   for issue in select * from jsonb_array_elements(coalesce(d.extraction->'warnings','[]')) loop
    if not exists(select 1 from jsonb_array_elements(review->'issues') i where i->>'text'=issue#>>'{}' and length(trim(coalesce(i->>'resolution','')))>0) then raise exception 'Resolve every extraction warning'; end if;
   end loop;
   if exists(select 1 from jsonb_array_elements(review->'issues') i where length(trim(coalesce(i->>'resolution','')))=0) then raise exception 'Resolve every flagged issue'; end if;
   price:=review->'commercial'->'price'; due:=review->'commercial'->'due_date'; revision:=review->'commercial'->'revision';
   if jsonb_typeof(price) is distinct from 'object' or jsonb_typeof(due) is distinct from 'object' or jsonb_typeof(revision) is distinct from 'object' then raise exception 'Review price, dates and revision allowance'; end if;
   if revision->>'unit' is null or revision->>'unit' not in ('requests','rounds','not_specified') or ((revision->>'unit'='not_specified')<>(revision->>'allowance' is null)) then raise exception 'Resolve revision requests versus rounds explicitly'; end if;
   if revision->>'allowance' is not null and (revision->>'allowance')::integer not between 0 and 10000 then raise exception 'Invalid revision allowance'; end if;
   if ((price->>'amount_cents' is null)<>(price->>'currency' is null)) or (price->>'amount_cents' is not null and ((price->>'amount_cents')::bigint not between 0 and 100000000 or price->>'currency' !~ '^[A-Z]{3}$')) then raise exception 'Invalid price and currency'; end if;
   if due->>'value' is not null then perform (due->>'value')::date; end if;
   for field in select value from jsonb_each(review->'commercial') loop
    if field->>'amount_cents' is not null or field->>'value' is not null or field->>'unit' in ('requests','rounds') then
     if not exists(select 1 from document_spans s where s.document_id=d.id and s.id=(field->>'span_id')::uuid and length(trim(coalesce(field->>'quote','')))>0 and position(field->>'quote' in s.text)>0) then raise exception 'Each reviewed commercial field needs valid source evidence'; end if;
    end if;
   end loop;
   if price->>'amount_cents' is not null and ((price->>'amount_cents')::bigint<>p.original_amount_cents or price->>'currency'<>p.currency) then
    if coalesce(review->>'price_choice','') not in ('basics','agreement') then raise exception 'Choose explicitly between Basics and agreement price'; end if;
    if review->>'price_choice'='agreement' then update projects set original_amount_cents=(price->>'amount_cents')::bigint,currency=price->>'currency' where id=p.id; end if;
   end if;
   if due->>'value' is not null and (due->>'value')::date is distinct from p.agreed_due_date then
    if coalesce(review->>'date_choice','') not in ('basics','agreement') then raise exception 'Choose explicitly between Basics and agreement date'; end if;
    if review->>'date_choice'='agreement' then update projects set agreed_due_date=(due->>'value')::date where id=p.id; end if;
   end if;
  end if;
  if p_section='policy' and p_payload->>'mode'='enabled' and exists(select 1 from scope_versions s where s.project_id=p.id and s.version=p.scope_version and s.agreement->'commercial'->'revision'->>'unit' in ('rounds','not_specified')) then raise exception 'This agreement requires review-only handling'; end if;
  result:=onboarding_command_v1(p_project,p_expected,p_section,p_payload,p_key);
  if p_section='document' then
   update projects set current_agreement_document_id=(result->>'documentId')::uuid where id=p.id;
   update jobs set status='superseded',lease_until=null,lease_token=null where document_id in (select id from documents where project_id=p.id and id<>(result->>'documentId')::uuid) and status in ('pending','processing');
  elsif p_section='scope' and review is not null then
   update scope_versions set agreement=review where project_id=p.id and version=(result->'project'->>'scope_version')::integer;
   update documents set review_draft=review,review_version=review_version+1 where id=d.id;
  elsif p_section='basics' and p.scope_version>0 then
   -- Commercial changes require fresh conflict review, retaining historical baselines.
   if (p_payload->>'original_amount_cents')::bigint<>p.original_amount_cents or p_payload->>'currency'<>p.currency or (p_payload->>'agreed_due_date')::date is distinct from p.agreed_due_date then
    update projects set scope_version=0,policy_version=0,policy=null,setup_step=2 where id=p.id;
    update documents set review_draft=jsonb_set(jsonb_set(review_draft,'{price_choice}','""'),'{date_choice}','""'),review_version=review_version+1 where id=p.current_agreement_document_id;
   end if;
  end if;
  select * into p from projects where id=p.id;
  result:=jsonb_set(result,'{project}',to_jsonb(p));
  update command_receipts set result=cmd.result where user_id=auth.uid() and key=p_key;
  return result;
 end if;
 insert into command_receipts values(auth.uid(),p_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.onboarding_command(uuid,integer,text,jsonb,text) from public,anon;
grant execute on function public.onboarding_command(uuid,integer,text,jsonb,text) to authenticated,service_role;

-- Lock project before job, matching upload/replacement lock order. A stale lease cannot publish.
alter function public.finish_document_job(uuid,uuid,jsonb,jsonb,text,boolean) rename to finish_document_job_v1;
revoke all on function public.finish_document_job_v1(uuid,uuid,jsonb,jsonb,text,boolean) from public,anon,authenticated,service_role;
create function public.finish_document_job(p_job uuid,p_lease uuid,p_spans jsonb,p_extraction jsonb,p_error text,p_unsupported boolean default false)
returns boolean language plpgsql security definer set search_path=public as $$
declare pid uuid; did uuid; current_doc uuid;
begin
 select d.project_id,d.id into pid,did from documents d join jobs j on j.document_id=d.id where j.id=p_job;
 if pid is null then return false; end if;
 select current_agreement_document_id into current_doc from projects where id=pid for update;
 if current_doc is not null and current_doc<>did then return false; end if;
 return finish_document_job_v1(p_job,p_lease,p_spans,p_extraction,p_error,p_unsupported);
end $$;
revoke all on function public.finish_document_job(uuid,uuid,jsonb,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_document_job(uuid,uuid,jsonb,jsonb,text,boolean) to service_role;
