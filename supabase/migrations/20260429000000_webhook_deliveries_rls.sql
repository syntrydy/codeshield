-- Lock down webhook_deliveries: service_role only.
-- RLS with zero policies denies anon + authenticated entirely;
-- service_role bypasses RLS by design and retains full access.
alter table public.webhook_deliveries enable row level security;
