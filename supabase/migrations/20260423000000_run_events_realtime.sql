-- Expose run_events on the Supabase Realtime publication so the frontend can
-- subscribe to INSERT changes during a running review (useRunEvents hook).
-- Without this, only the initial batch fetched via REST is visible; live
-- events during a running review never reach the browser.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'run_events'
  ) then
    execute 'alter publication supabase_realtime add table public.run_events';
  end if;
end $$;
