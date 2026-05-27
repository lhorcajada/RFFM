import { useCallback, useEffect, useState } from 'react';
import { getTrialDays, type SeasonAccessTrialDay } from '../../../../../services/seasonAccessService';

export default function useTrialDays(seasonId?: string | null, category?: string | null) {
  const [days, setDays] = useState<SeasonAccessTrialDay[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!seasonId || !category) {
      setDays([]);
      return;
    }
    setLoading(true);
    try {
      const result = await getTrialDays(seasonId, category);
      setDays(result ?? []);
    } catch (err) {
      setDays([]);
    } finally {
      setLoading(false);
    }
  }, [seasonId, category]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      if (!mounted) return;
      await load();
    })();

    const handler = (e: Event) => {
      try {
        const ce = e as CustomEvent;
        const detail = ce?.detail ?? {};
        if (detail?.seasonId && detail?.category) {
          if (String(detail.seasonId) !== String(seasonId) || String(detail.category) !== String(category)) return;
        }
      } catch {}
      void load();
    };

    try { window.addEventListener('rffm.season_access_changed', handler as EventListener); } catch {}

    return () => {
      mounted = false;
      try { window.removeEventListener('rffm.season_access_changed', handler as EventListener); } catch {}
    };
  }, [load]);

  return { days, loading, reload: load } as const;
}
