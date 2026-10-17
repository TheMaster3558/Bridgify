-- Email/password accounts do not require email verification.
-- Disable Confirm email in the hosted Supabase Email provider settings as well.
-- Keep matching the authenticated account email and the unguessable invitation.
create or replace function public.accept_invitation(p_token text) returns text language plpgsql security definer set search_path=public as $$
declare invite project_invitations; account_email text; path text;
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 select lower(email) into account_email from auth.users where id=auth.uid();
 perform 1 from projects where id=(select project_id from project_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex')) for update;
 select * into invite from project_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or invite.revoked_at is not null or (invite.accepted_by is null and invite.expires_at<=now()) or account_email is distinct from invite.email or (invite.accepted_by is not null and invite.accepted_by<>auth.uid()) then raise exception 'Invitation unavailable. Sign in with the invited email or ask the owner for a new invitation.'; end if;
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
