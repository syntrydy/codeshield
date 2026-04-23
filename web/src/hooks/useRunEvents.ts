import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { RunEvent } from "../lib/api";

export function useRunEvents(runId: string | undefined, initialEvents: RunEvent[] = []) {
  const [events, setEvents] = useState<RunEvent[]>(initialEvents);

  // Re-seed whenever the fetched batch arrives or its identity changes.
  // React Query returns a stable reference for unchanged data, so this does
  // not cause extra work on typical re-renders.
  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    if (!runId) return;

    const channel = supabase
      .channel(`run-events:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "run_events",
          filter: `run_id=eq.${runId}`,
        },
        (payload) => {
          const next = payload.new as RunEvent;
          setEvents((prev) => (prev.some((e) => e.id === next.id) ? prev : [...prev, next]));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [runId]);

  return events;
}
