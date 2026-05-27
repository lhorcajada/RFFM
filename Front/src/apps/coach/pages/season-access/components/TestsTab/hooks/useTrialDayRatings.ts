import { useCallback, useEffect, useState } from 'react';
import { getTrialDayRatings, type SeasonAccessTrialDay, type SeasonAccessTrialPlayerDto } from '../../../../../services/seasonAccessService';

export default function useTrialDayRatings(day?: SeasonAccessTrialDay | null, previousDayId?: string | null) {
  const [raw, setRaw] = useState<SeasonAccessTrialPlayerDto[]>([]);
  const [filtered, setFiltered] = useState<SeasonAccessTrialPlayerDto[]>([]);
  const [excluded, setExcluded] = useState<Array<{ id: string; reason: string; removedFromDate: any }>>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!day) {
      setRaw([]);
      setFiltered([]);
      setExcluded([]);
      return;
    }
    setLoading(true);
    try {
      const result = await getTrialDayRatings(day.id);
      setRaw(result ?? []);

      const included: SeasonAccessTrialPlayerDto[] = [];
      const excludedList: Array<{ id: string; reason: string; removedFromDate: any }> = [];
      const currentDate = day.date ? new Date(String(day.date) + 'T00:00:00') : null;

      for (const r of (result ?? [])) {
        // only consider items that belong to this day
        if (String(r.trialDayId) !== String(day.id)) continue;

        const removed = (r as any).removedFromDate;
        if (!removed) {
          included.push(r);
          continue;
        }

        // handle sentinel string 'null' from some backends
        if (String(removed).trim().toLowerCase() === 'null') {
          included.push(r);
          continue;
        }

        try {
          const removedDate = new Date(String(removed) + 'T00:00:00');
          if (isNaN(removedDate.getTime())) {
            included.push(r);
          } else if (!currentDate || removedDate > currentDate) {
            included.push(r);
          } else {
            excludedList.push({ id: String(r.id), reason: 'removedDate<=currentDate', removedFromDate: removed });
          }
        } catch (err) {
          included.push(r);
        }
      }

      setFiltered(included);
      setExcluded(excludedList);

      // debug removed
    } catch (err) {
      setRaw([]);
      setFiltered([]);
      setExcluded([]);
    } finally {
      setLoading(false);
    }
  }, [day?.id, day?.date]);

  useEffect(() => {
    void load();
    return () => {
      // noop
    };
  }, [load, previousDayId]);

  return {
    raw,
    filtered,
    excluded,
    loading,
    reload: load,
    counts: { rawCount: raw.length, filteredCount: filtered.length, excludedCount: excluded.length },
  } as const;
}
