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

  const applyLocalUpdate = useCallback((upd: {
    trialPlayerId?: string | null;
    id?: string | null;
    score?: number | null;
    totalGoals?: number | null;
    status?: string | null;
    idealDemarcationId?: number | null;
    possibleDemarcationIds?: number[] | null;
    removedFromDate?: string | null;
    playerName?: string | null;
    teamName?: string | null;
    federationPlayerCode?: string | null;
    birthYear?: number | null;
    category?: string | null;
  }) => {
    if (!day) return;
    const idToMatch = String(upd.trialPlayerId ?? upd.id ?? '');
    if (!idToMatch) return;

    const currentDate = day.date ? new Date(String(day.date) + 'T00:00:00') : null;
    const isIncludedByRemoved = (removed: any) => {
      if (!removed) return true;
      try {
        const s = String(removed).trim();
        if (s.toLowerCase() === 'null') return true;
        const removedDate = new Date(s + 'T00:00:00');
        if (isNaN(removedDate.getTime())) return true;
        return !currentDate || removedDate > currentDate;
      } catch {
        return true;
      }
    };

    setRaw((prev) => {
      const idx = prev.findIndex((r) => String(r.id) === idToMatch);
      if (idx >= 0) {
        const old = prev[idx];
        const updated = {
          ...old,
          score: typeof upd.score !== 'undefined' ? upd.score : old.score,
          totalGoals: typeof upd.totalGoals !== 'undefined' ? upd.totalGoals : old.totalGoals,
          status: typeof upd.status !== 'undefined' ? upd.status : old.status,
          idealDemarcationId: typeof upd.idealDemarcationId !== 'undefined' ? upd.idealDemarcationId : old.idealDemarcationId,
          possibleDemarcationIds: typeof upd.possibleDemarcationIds !== 'undefined' ? (upd.possibleDemarcationIds ?? []) : old.possibleDemarcationIds,
          removedFromDate: typeof upd.removedFromDate !== 'undefined' ? upd.removedFromDate : old.removedFromDate,
          playerName: typeof upd.playerName !== 'undefined' ? upd.playerName : old.playerName,
          teamName: typeof upd.teamName !== 'undefined' ? upd.teamName : old.teamName,
          federationPlayerCode: typeof upd.federationPlayerCode !== 'undefined' ? upd.federationPlayerCode : old.federationPlayerCode,
          birthYear: typeof upd.birthYear !== 'undefined' ? upd.birthYear : old.birthYear,
          category: typeof upd.category !== 'undefined' ? upd.category : old.category,
        } as SeasonAccessTrialPlayerDto;
        const copy = prev.slice();
        copy[idx] = updated;
        return copy;
      }

      // add new item (belongs to this day)
      const added: SeasonAccessTrialPlayerDto = {
        id: idToMatch,
        trialDayId: day.id,
        score: typeof upd.score !== 'undefined' ? upd.score : null,
        notes: null,
        idealDemarcationId: typeof upd.idealDemarcationId !== 'undefined' ? upd.idealDemarcationId : null,
        possibleDemarcationIds: typeof upd.possibleDemarcationIds !== 'undefined' ? (upd.possibleDemarcationIds ?? []) : [],
        totalGoals: typeof upd.totalGoals !== 'undefined' ? upd.totalGoals : null,
        status: typeof upd.status !== 'undefined' ? upd.status : null,
        birthYear: typeof upd.birthYear !== 'undefined' ? upd.birthYear : null,
        category: typeof upd.category !== 'undefined' ? upd.category : null,
        teamCode: null,
        teamName: typeof upd.teamName !== 'undefined' ? upd.teamName : null,
        federationPlayerCode: typeof upd.federationPlayerCode !== 'undefined' ? upd.federationPlayerCode : null,
        playerName: typeof upd.playerName !== 'undefined' ? upd.playerName : null,
        removedFromDate: typeof upd.removedFromDate !== 'undefined' ? upd.removedFromDate : null,
      };
      return [...prev, added];
    });

    setFiltered((prev) => {
      const idx = prev.findIndex((r) => String(r.id) === idToMatch);
      const existing = idx >= 0 ? prev[idx] : null;

      const merged: SeasonAccessTrialPlayerDto = {
        id: idToMatch,
        trialDayId: day.id,
        score: typeof upd.score !== 'undefined' ? upd.score : (existing ? existing.score : null),
        notes: existing ? existing.notes : null,
        idealDemarcationId: typeof upd.idealDemarcationId !== 'undefined' ? upd.idealDemarcationId : (existing ? existing.idealDemarcationId : null),
        possibleDemarcationIds: typeof upd.possibleDemarcationIds !== 'undefined' ? (upd.possibleDemarcationIds ?? []) : (existing ? existing.possibleDemarcationIds ?? [] : []),
        totalGoals: typeof upd.totalGoals !== 'undefined' ? upd.totalGoals : (existing ? existing.totalGoals : null),
        status: typeof upd.status !== 'undefined' ? upd.status : (existing ? existing.status : null),
        birthYear: typeof upd.birthYear !== 'undefined' ? upd.birthYear : (existing ? existing.birthYear : null),
        category: typeof upd.category !== 'undefined' ? upd.category : (existing ? existing.category : null),
        teamCode: existing ? existing.teamCode : null,
        teamName: typeof upd.teamName !== 'undefined' ? upd.teamName : (existing ? existing.teamName : null),
        federationPlayerCode: typeof upd.federationPlayerCode !== 'undefined' ? upd.federationPlayerCode : (existing ? existing.federationPlayerCode : null),
        playerName: typeof upd.playerName !== 'undefined' ? upd.playerName : (existing ? existing.playerName : null),
        removedFromDate: typeof upd.removedFromDate !== 'undefined' ? upd.removedFromDate : (existing ? existing.removedFromDate : null),
      };

      const shouldInclude = isIncludedByRemoved(merged.removedFromDate);

      if (idx >= 0) {
        if (shouldInclude) {
          const copy = prev.slice();
          copy[idx] = merged;
          return copy;
        }
        // remove if no longer included
        return prev.filter((r) => String(r.id) !== idToMatch);
      }

      // not present in filtered
      if (shouldInclude) {
        return [...prev, merged];
      }
      return prev;
    });

    setExcluded((prev) => {
      const existsIdx = prev.findIndex((e) => e.id === idToMatch);
      const removed = upd.removedFromDate ?? null;
      const shouldInclude = isIncludedByRemoved(removed);
      if (shouldInclude) {
        if (existsIdx >= 0) return prev.filter((e) => e.id !== idToMatch);
        return prev;
      }
      // should be excluded
      if (existsIdx >= 0) return prev;
      return [...prev, { id: idToMatch, reason: 'removedDate<=currentDate', removedFromDate: removed }];
    });
  }, [day]);

  return {
    raw,
    filtered,
    excluded,
    loading,
    reload: load,
    counts: { rawCount: raw.length, filteredCount: filtered.length, excludedCount: excluded.length },
    applyLocalUpdate,
  } as const;
}
