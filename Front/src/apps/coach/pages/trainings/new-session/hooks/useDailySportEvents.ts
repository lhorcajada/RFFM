import { useEffect, useState } from "react";
import { getSportEvents, type SportEventResponse } from "../../../../services/sportEventService";

/** Fetches the sport events happening on a single exact date, for the "Evento deportivo"
 * picker in NewSessionPage.tsx — replaces the old free-text "Evento deportivo ID" field
 * (no coach can know a GUID by heart). Queries `getSportEvents` with `startDate === endDate`
 * so only events on that day come back. No `date` (unscheduled session) means no query — the
 * picker has nothing to search for yet. Re-fetches whenever `teamId`/`date` change. */
export function useDailySportEvents(teamId: string, date: string | null) {
  const [events, setEvents] = useState<SportEventResponse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!teamId || !date) {
      setEvents([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getSportEvents(teamId, 1, 100, date, date)
      .then((paged) => {
        if (!cancelled) setEvents(paged.items);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, date]);

  return { events, loading };
}

export default useDailySportEvents;
