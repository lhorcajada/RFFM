import { useCallback, useEffect, useRef, useState } from "react";
import {
  getEventAttendanceSummaries,
  type EventAttendanceSummaryDto,
} from "../services/eventAttendanceSummaryService";

export function useEventAttendanceSummaries(
  teamId: string | undefined,
  eventIds: string[]
) {
  const [summaries, setSummaries] = useState<Record<string, EventAttendanceSummaryDto>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const key = [...eventIds].sort().join(",");
  const keyRef = useRef<string>("");

  const fetchSummaries = useCallback(() => {
    if (!teamId || eventIds.length === 0) {
      setSummaries({});
      return;
    }
    setLoading(true);
    setError(null);
    getEventAttendanceSummaries(teamId, eventIds)
      .then((list) => {
        const map: Record<string, EventAttendanceSummaryDto> = {};
        for (const s of list) map[s.eventId] = s;
        setSummaries(map);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, key]);

  useEffect(() => {
    if (keyRef.current === key && !teamId) return;
    keyRef.current = key;
    fetchSummaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, key]);

  return { summaries, loading, error, refetch: fetchSummaries } as const;
}

export default useEventAttendanceSummaries;
