-- Allow 'rerequested' as a valid trigger_event (fired when user clicks Re-run on a Check Run)
alter table runs
  drop constraint if exists runs_trigger_event_check;

alter table runs
  add constraint runs_trigger_event_check
    check (trigger_event in ('opened', 'synchronize', 'reopened', 'manual', 'rerequested'));
