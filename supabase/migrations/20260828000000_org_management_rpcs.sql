-- Org management RPCs for the new "Team" tab (mobile org control) -- these mirror
-- workify-web's own migrations exactly (0008_org_billing_schema.sql for the unique index,
-- 0012_seat_member_management.sql, 0014_activate_member.sql, 0015_create_organization.sql for
-- the functions), already live in prod. The baseline dump this local project started from
-- (20260825000000_prod_baseline.sql) only carried workify_create_organization -- these three
-- were missed and are added here so local dev matches prod's real RPC surface.
--
-- Idempotent: CREATE OR REPLACE / IF NOT EXISTS throughout, safe to re-run.

-- Enforces "one org membership row per user" -- workify_activate_seat_member and
-- workify_replace_seat_member both rely on this to never create a second row for the same
-- user_id (see their comments below).
create unique index if not exists "workify_one_org_per_user"
  on public.workify_organization_members ("user_id") where "user_id" is not null;

-- auth.users isn't exposed via PostgREST and supabase-js's admin API has no getUserByEmail, so
-- resolving "add member by email" to a user id needs a SECURITY DEFINER function that can read
-- auth.users directly. service_role only.
create or replace function public.workify_get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where email = p_email limit 1;
$$;

revoke all on function public.workify_get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.workify_get_user_id_by_email(text) to service_role;

-- Atomic seat reassignment for member add/replace/vacant-seat-claim. Handles both: a seat with
-- an active member (deactivates that membership, creates a new one, repoints the seat) and a
-- vacant seat (just creates the new membership and points the seat at it). Either way,
-- ai_answers_used/allowance stay on the seat -- the new member inherits whatever's left this
-- billing period, per spec.
create or replace function public.workify_replace_seat_member(
  p_seat_id uuid,
  p_new_user_id uuid,
  p_new_role text default 'member'
)
returns table (new_member_id uuid)
language plpgsql
as $$
declare
  v_org_id uuid;
  v_old_member_id uuid;
  v_new_member_id uuid;
begin
  select organization_id, current_member_id into v_org_id, v_old_member_id
  from public.workify_seats where id = p_seat_id for update;

  if v_org_id is null then
    raise exception 'Seat % not found', p_seat_id;
  end if;

  if v_old_member_id is not null then
    update public.workify_organization_members
    set seat_status = 'deactivated', deactivated_at = now(), updated_at = now()
    where id = v_old_member_id;
  end if;

  insert into public.workify_organization_members (organization_id, user_id, role, seat_status)
  values (v_org_id, p_new_user_id, p_new_role, 'active')
  returning id into v_new_member_id;

  update public.workify_seats
  set current_member_id = v_new_member_id, updated_at = now()
  where id = p_seat_id;

  return query select v_new_member_id;
end;
$$;

revoke all on function public.workify_replace_seat_member(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.workify_replace_seat_member(uuid, uuid, text) to service_role;

-- Atomic reactivation of an already-existing (deactivated) member. Distinct from
-- workify_replace_seat_member: that always INSERTs a new membership row, which would violate
-- workify_one_org_per_user for a user who already has a (deactivated) row. This updates the
-- existing row in place instead.
create or replace function public.workify_activate_seat_member(p_seat_id uuid, p_member_id uuid)
returns void
language plpgsql
as $$
begin
  update public.workify_seats
  set current_member_id = p_member_id, updated_at = now()
  where id = p_seat_id;

  update public.workify_organization_members
  set seat_status = 'active', deactivated_at = null, updated_at = now()
  where id = p_member_id;
end;
$$;

revoke all on function public.workify_activate_seat_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.workify_activate_seat_member(uuid, uuid) to service_role;
