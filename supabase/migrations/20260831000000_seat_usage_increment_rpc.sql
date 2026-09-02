-- Adds workify_increment_seat_usage, needed by rag-chat's new credit-metering gate
-- (_shared/org.ts's recordAiAnswerUsage). This mirrors workify-web's own migration
-- (0010_seat_usage_increment.sql), already live in prod -- same gap as
-- 20260828000000_org_management_rpcs.sql's three RPCs: the baseline dump
-- (20260825000000_prod_baseline.sql) only carried workify_create_organization, missing this one
-- and the seat-member RPCs that migration already backfilled.
--
-- Atomic increment via a single UPDATE (not read-then-write) so two concurrent requests against
-- the same seat -- from the web app and the mobile app, or two devices on the same seat -- can't
-- both read ai_answers_used=79 before either writes 80, undercounting by one.
--
-- Idempotent: CREATE OR REPLACE, safe to re-run.

create or replace function public.workify_increment_seat_usage(p_seat_id uuid)
returns table (
  ai_answers_used integer,
  ai_answers_allowance integer,
  notified_80_pct boolean,
  notified_100_pct boolean
)
language sql
as $$
  update workify_seats
  set ai_answers_used = ai_answers_used + 1,
      was_used_this_period = true,
      updated_at = now()
  where id = p_seat_id
  returning ai_answers_used, ai_answers_allowance, notified_80_pct, notified_100_pct;
$$;

revoke all on function public.workify_increment_seat_usage(uuid) from public, anon, authenticated;
grant execute on function public.workify_increment_seat_usage(uuid) to service_role;
