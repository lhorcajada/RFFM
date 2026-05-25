import { useEffect, useState } from "react";
import {
  getTrialDays,
  getTrialDayRatings,
  type SeasonAccessTrialDay,
  type SeasonAccessTrialPlayerDto,
} from "../../../../services/seasonAccessService";

function filterOutRemoved(ratings: SeasonAccessTrialPlayerDto[] | null | undefined, currentDayDate: string | null | undefined) {
  const currentDate = currentDayDate ? new Date(String(currentDayDate) + "T00:00:00") : null;
  if (!Array.isArray(ratings)) return [];
  return ratings.filter((r) => {
    if (!r) return false;
    const removed = r.removedFromDate;
    if (!removed) return true;
    if (!currentDate) return true;
    try {
      const removedDate = new Date(String(removed) + "T00:00:00");
      return removedDate > currentDate;
    } catch {
      return true;
    }
  });
}

export default function usePrepareTests(seasonId?: string | null, category?: string | null) {
  const [days, setDays] = useState<SeasonAccessTrialDay[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [ratings, setRatings] = useState<SeasonAccessTrialPlayerDto[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!seasonId || !category) {
      setDays([]);
      return;
    }
    setLoadingDays(true);
    getTrialDays(seasonId, category)
      .then((d) => {
        if (!mounted) return;
        setDays(d || []);
        setSelectedDayIndex(0);
      })
      .catch(() => {
        if (mounted) setDays([]);
      })
      .finally(() => {
        if (mounted) setLoadingDays(false);
      });

    return () => {
      mounted = false;
    };
  }, [seasonId, category]);

  useEffect(() => {
    let mounted = true;
    async function loadRatings() {
      if (!seasonId || !category) {
        setRatings([]);
        return;
      }
      const day = days[selectedDayIndex];
      if (!day) {
        setRatings([]);
        return;
      }
      setLoadingRatings(true);
      try {
        const r = await getTrialDayRatings(day.id);
        if (!mounted) return;
        const filteredByDay = (r ?? []).filter((x) => String(x.trialDayId) === String(day.id));
        const filtered = filterOutRemoved(filteredByDay, day.date);
        setRatings(filtered);
      } catch (err) {
        if (mounted) setRatings([]);
      } finally {
        if (mounted) setLoadingRatings(false);
      }
    }

    void loadRatings();
    return () => {
      mounted = false;
    };
  }, [days, selectedDayIndex, seasonId, category]);

  const reloadRatings = async () => {
    const day = days[selectedDayIndex];
    if (!day) return;
    setLoadingRatings(true);
    try {
      const r = await getTrialDayRatings(day.id);
      const filteredByDay = (r ?? []).filter((x) => String(x.trialDayId) === String(day.id));
      const filtered = filterOutRemoved(filteredByDay, day.date);
      setRatings(filtered);
    } finally {
      setLoadingRatings(false);
    }
  };

  return {
    days,
    loadingDays,
    selectedDayIndex,
    setSelectedDayIndex,
    ratings,
    loadingRatings,
    reloadRatings,
  } as const;
}
