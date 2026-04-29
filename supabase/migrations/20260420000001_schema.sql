-- Full schema: all tables, indexes, and RLS policies per DESIGN.md §4 and §5.

-- Enable pgvector (used for future embedding search features)
create extension if not exists vector;

-- ============================================================
-- github_app_installations
-- One row per GitHub App installation (per user account/org).
-- ============================================================
create table public.github_app_installations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login   text not null,
  account_type    text not null check (account_type in ('User', 'Organization')),
  suspended_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.github_app_installations enable row level security;

create policy "own installations"
  on public.github_app_installations
  for select
  using (auth.uid() = user_id);

-- ============================================================
-- projects
-- One row per connected repository.
-- ============================================================
create table public.projects (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  installation_id       uuid not null references public.github_app_installations(id) on delete cascade,
  github_repo_id        bigint not null unique,
  github_repo_full_name text not null,
  default_branch        text not null default 'main',
  branch_filter         text,
  enabled_specialists   text[] not null default array['security','correctness','performance','style'],
  severity_threshold    text not null default 'low'
                          check (severity_threshold in ('info','low','medium','high','critical')),
  review_output_locale  text not null default 'en'
                          check (review_output_locale in ('en','fr')),
  created_at            timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "own projects"
  on public.projects
  for select
  using (auth.uid() = user_id);

create policy "update own projects"
  on public.projects
  for update
  using (auth.uid() = user_id);

-- ============================================================
-- runs
-- One row per review run.
-- ============================================================
create table public.runs (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  pr_number            int not null,
  pr_head_sha          text not null,
  pr_base_sha          text not null,
  trigger_event        text not null
                         check (trigger_event in ('opened','synchronize','reopened','manual')),
  status               text not null default 'queued'
                         check (status in ('queued','running','completed','failed','cancelled')),
  github_check_run_id  bigint,
  total_input_tokens   int not null default 0,
  total_output_tokens  int not null default 0,
  total_cost_usd       numeric(10,4) not null default 0,
  error_message        text,
  created_at           timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz
);

create index runs_project_id_created_at_idx on public.runs (project_id, created_at desc);
create index runs_pr_head_sha_idx on public.runs (pr_head_sha);

alter table public.runs enable row level security;

create policy "own runs"
  on public.runs
  for select
  using (auth.uid() = user_id);

-- ============================================================
-- run_events
-- Streaming event log (bigserial for insert throughput).
-- ============================================================
create table public.run_events (
  id         bigserial primary key,
  run_id     uuid not null references public.runs(id) on delete cascade,
  event_type text not null,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index run_events_run_id_created_at_idx on public.run_events (run_id, created_at);

alter table public.run_events enable row level security;

create policy "own run events"
  on public.run_events
  for select
  using (
    run_id in (select id from public.runs where user_id = auth.uid())
  );

-- ============================================================
-- findings
-- Structured specialist findings (bigserial for throughput).
-- ============================================================
create table public.findings (
  id             bigserial primary key,
  run_id         uuid not null references public.runs(id) on delete cascade,
  specialist     text not null
                   check (specialist in ('security','correctness','performance','style')),
  severity       text not null
                   check (severity in ('info','low','medium','high','critical')),
  file_path      text,
  line_start     int,
  line_end       int,
  title          text not null,
  explanation    text not null,
  suggested_fix  text,
  confidence     text not null default 'medium'
                   check (confidence in ('low','medium','high')),
  created_at     timestamptz not null default now()
);

create index findings_run_id_severity_idx on public.findings (run_id, severity);

alter table public.findings enable row level security;

create policy "own findings"
  on public.findings
  for select
  using (
    run_id in (select id from public.runs where user_id = auth.uid())
  );

-- ============================================================
-- webhook_deliveries
-- Idempotency audit log. Redis is the primary; this is backup.
-- ============================================================
create table public.webhook_deliveries (
  delivery_id    text primary key,
  event_type     text not null,
  repo_full_name text not null,
  received_at    timestamptz not null default now()
);

-- RLS enabled with zero policies in 20260429000000_webhook_deliveries_rls.sql:
-- denies anon + authenticated; service_role bypasses RLS and retains access.

-- ============================================================
-- user_preferences
-- Per-user UI settings.
-- ============================================================
create table public.user_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  ui_locale  text not null default 'en' check (ui_locale in ('en','fr')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "own preferences"
  on public.user_preferences
  for all
  using (auth.uid() = user_id);

-- updated_at trigger (invariant maintenance — the one legitimate use of a trigger)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_preferences_updated_at
  before update on public.user_preferences
  for each row execute function public.set_updated_at();
