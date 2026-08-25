-- Local-only mirror of the tables workify-app needs from the shared prod project
-- (ref tdgzzuqlvknqgoccwbtz, same project workify-web points at). Hand-written from a read-only
-- inspection of prod on 2026-08-25 (mcp__supabase__list_tables verbose + pg_policies +
-- pg_get_functiondef via mcp__supabase__execute_sql) -- no CREATE/ALTER/DROP was ever run
-- against prod to produce this file, only SELECTs.
--
-- Scope: only what workify-app's Phases 3-5 touch (auth, orgs/seats, rag chat sessions/logs).
-- Deliberately omits prod tables unrelated to this app (dealers/research_runs, rag_shared,
-- rag_access_*, blog_*, stripe webhook/purchase ledgers, platform admin/audit, workspace docs,
-- profiles) -- none of workify-app's code reads or writes those.
--
-- If prod schema drifts, re-run the same read-only inspection and update this file by hand;
-- don't run `supabase db pull`/`db push` against prod -- pull can write bookkeeping rows into
-- prod's migration history table, which is exactly the kind of direct-prod-write this file
-- exists to avoid.

create extension if not exists pgcrypto with schema extensions;

-- workify_organizations ------------------------------------------------------------------
create table if not exists public.workify_organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  plan_tier text not null default 'individual'
    check (plan_tier in ('individual', 'team', 'professional', 'enterprise')),
  seat_limit integer not null,
  seats_purchased integer not null default 1,
  billing_cycle_anchor timestamptz not null default now(),
  base_library_capacity_pages integer not null default 0,
  additional_capacity_per_seat_pages integer not null default 0,
  purchased_extra_capacity_pages integer not null default 0,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'active'
    check (status in ('active', 'past_due', 'canceled', 'trialing', 'pending')),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workify_organizations enable row level security;
revoke all on public.workify_organizations from anon, authenticated;
grant all on public.workify_organizations to service_role;

-- workify_organization_members -----------------------------------------------------------
create table if not exists public.workify_organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.workify_organizations(id),
  user_id uuid references auth.users(id),
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  seat_status text not null default 'active'
    check (seat_status in ('active', 'deactivated', 'vacant')),
  invited_email text,
  joined_at timestamptz default now(),
  deactivated_at timestamptz,
  permissions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workify_organization_members enable row level security;
revoke all on public.workify_organization_members from anon, authenticated;
grant all on public.workify_organization_members to service_role;

-- workify_seats -----------------------------------------------------------------------
create table if not exists public.workify_seats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.workify_organizations(id),
  current_member_id uuid references public.workify_organization_members(id),
  billing_period_start date not null,
  billing_period_end date not null,
  ai_answers_allowance integer not null,
  ai_answers_used integer not null default 0,
  was_used_this_period boolean not null default false,
  scheduled_for_removal boolean not null default false,
  notified_80_pct boolean not null default false,
  notified_100_pct boolean not null default false,
  credit_fraction numeric not null default 1.00 check (credit_fraction in (0.25, 0.50, 0.75, 1.00)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.workify_seats enable row level security;
revoke all on public.workify_seats from anon, authenticated;
grant all on public.workify_seats to service_role;

-- workify_create_organization() -- mirrors prod's function (migration 0015_create_organization)
create or replace function public.workify_create_organization(
  p_name text,
  p_slug text,
  p_plan_tier text,
  p_seat_limit integer,
  p_seats_purchased integer,
  p_owner_user_id uuid,
  p_ai_answers_allowance integer,
  p_base_library_capacity_pages integer,
  p_additional_capacity_per_seat_pages integer,
  p_status text default 'active'
) returns table(organization_id uuid, member_id uuid, seat_id uuid)
language plpgsql
as $$
declare
  v_org_id uuid;
  v_member_id uuid;
  v_seat_id uuid;
begin
  insert into workify_organizations
    (name, slug, plan_tier, seat_limit, seats_purchased, base_library_capacity_pages,
     additional_capacity_per_seat_pages, owner_id, status)
  values
    (p_name, p_slug, p_plan_tier, p_seat_limit, p_seats_purchased, p_base_library_capacity_pages,
     p_additional_capacity_per_seat_pages, p_owner_user_id, p_status)
  returning id into v_org_id;

  insert into workify_organization_members (organization_id, user_id, role, seat_status)
  values (v_org_id, p_owner_user_id, 'owner', 'active')
  returning id into v_member_id;

  insert into workify_seats
    (organization_id, current_member_id, billing_period_start, billing_period_end,
     ai_answers_allowance, ai_answers_used)
  values
    (v_org_id, v_member_id, date_trunc('month', now())::date,
     (date_trunc('month', now()) + interval '1 month - 1 day')::date,
     p_ai_answers_allowance, 0)
  returning id into v_seat_id;

  return query select v_org_id, v_member_id, v_seat_id;
end;
$$;

-- rag_chat_sessions ---------------------------------------------------------------------
create table if not exists public.rag_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text not null default 'Untitled chat',
  nodes jsonb not null default '[]'::jsonb,
  active_node_id text,
  manual_id text,
  locale text,
  message_count integer not null default 0,
  email text,
  shadow_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.rag_chat_sessions enable row level security;

drop policy if exists "Users can view own rag chat sessions" on public.rag_chat_sessions;
create policy "Users can view own rag chat sessions" on public.rag_chat_sessions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Users can insert own rag chat sessions" on public.rag_chat_sessions;
create policy "Users can insert own rag chat sessions" on public.rag_chat_sessions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can update own rag chat sessions" on public.rag_chat_sessions;
create policy "Users can update own rag chat sessions" on public.rag_chat_sessions
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete own rag chat sessions" on public.rag_chat_sessions;
create policy "Users can delete own rag chat sessions" on public.rag_chat_sessions
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.rag_chat_sessions to authenticated;
grant all on public.rag_chat_sessions to service_role;

-- rag_prompt_logs -- already exists in prod as-is (28 rows live); this recreates its shape
-- locally only. service-role-only, matching prod (no pg_policies rows for this table on prod).
create table if not exists public.rag_prompt_logs (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references auth.users(id),
  session_id uuid references public.rag_chat_sessions(id),
  question text not null,
  answer text,
  manual_id text,
  locale text,
  shadow_user_id uuid,
  organization_id uuid references public.workify_organizations(id),
  seat_id uuid references public.workify_seats(id),
  credits_consumed numeric not null default 1,
  usage_metadata jsonb,
  provider_model text,
  prompt_tokens integer,
  output_tokens integer,
  thinking_tokens integer,
  total_tokens integer,
  generation_calls integer,
  retrieval_used boolean,
  retrieval_expanded boolean,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now()
);
alter table public.rag_prompt_logs enable row level security;
revoke all on public.rag_prompt_logs from anon, authenticated;
grant all on public.rag_prompt_logs to service_role;

-- syspare_rag_manuals -- read-only reference data for an optional future manual picker
create table if not exists public.syspare_rag_manuals (
  id uuid primary key default gen_random_uuid(),
  manual_id text not null unique,
  display_name text not null,
  pdf_folder text not null,
  cache_dir text not null,
  image_dir text not null,
  ocr_lang text not null default 'eng',
  description text not null default '',
  organization_id uuid references public.workify_organizations(id),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.syspare_rag_manuals enable row level security;
grant select on public.syspare_rag_manuals to anon, authenticated;
grant all on public.syspare_rag_manuals to service_role;
