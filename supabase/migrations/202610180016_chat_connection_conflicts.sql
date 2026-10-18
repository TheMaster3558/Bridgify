-- A conversation reservation belongs to a real project until that project is
-- deleted or its unactivated connection is changed. Never steal a reservation.
create or replace function public.begin_chat_test(p_project uuid,p_expected integer,p_participants jsonb,p_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p projects; b chat_bindings; conflict_project projects; constraint_name text;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select * into p from projects where id=p_project for update;
 if not found or not public.is_owner(p.organization_id) then raise insufficient_privilege; end if;
 if p.version is distinct from p_expected then raise exception 'Project changed; refresh' using errcode='40001'; end if;
 if p.status not in ('draft','paused','review_only') or p.people is null then raise exception 'Save participants; pause an active project before verification'; end if;
 select * into b from chat_bindings where project_id=p.id;
 if b.test_state in ('sending','unknown') then raise exception 'Introduction delivery is pending or unknown. Inspect the conversation before retrying.'; end if;
 begin
  insert into chat_bindings(project_id,instance_id,chat_guid,participants,membership_hash,test_state)
  values(p.id,p.people->>'instance_id',p.people->>'chat_guid',p_participants,p_hash,'sending')
  on conflict(project_id) do update set participants=excluded.participants,membership_hash=excluded.membership_hash,
   test_state='sending',verified_at=null,webhook_verified_at=null,hold_reason=null;
 exception when unique_violation then
  get stacked diagnostics constraint_name = CONSTRAINT_NAME;
  if constraint_name is distinct from 'chat_bindings_instance_id_chat_guid_key' then raise; end if;
  select pr.* into conflict_project from chat_bindings cb join projects pr on pr.id=cb.project_id
   where cb.instance_id=p.people->>'instance_id' and cb.chat_guid=p.people->>'chat_guid' and cb.project_id<>p.id;
  if found and public.is_owner(conflict_project.organization_id) then
   select * into b from chat_bindings where project_id=conflict_project.id;
   raise exception using errcode='23505', constraint='chat_bindings_instance_id_chat_guid_key', hint='chat_binding_reserved', message=format(
    'This conversation is reserved by your project "%s" (%s; introduction %s). Open that project to check its connection. A pending or unknown send must be checked before releasing it.',
    conflict_project.name,conflict_project.status,b.test_state);
  end if;
  -- Do not disclose another workspace's project identity, status or send state.
  raise exception using errcode='23505', constraint='chat_bindings_instance_id_chat_guid_key', hint='chat_binding_reserved', message='This conversation is already connected to another project. Its owner must release that connection before it can be reused.';
 end;
 return jsonb_build_object('project',to_jsonb(p));
end $$;
revoke all on function public.begin_chat_test(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.begin_chat_test(uuid,integer,jsonb,text) to authenticated;
