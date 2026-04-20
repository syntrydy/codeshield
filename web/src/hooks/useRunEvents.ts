import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { RunEvent } from "../lib/api";

export function useRunEvents(runId: string | undefined, initialEvents: RunEvent[] = []) {
  const [events, setEvents] = useState<RunEvent[]>(initialEvents);

  useEffect(() => {
    if (!runId) return;
    setEvents(initialEvents);

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
          setEvents((prev) => [...prev, payload.new as RunEvent]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // initialEvents intentionally excluded — we only reset when runId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return events;
}
