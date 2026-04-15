import { useEffect, useRef, useState } from "react";
import { upsertSeasonPrepEvaluations } from "../../../../services/seasonPrepEvaluationsService";
import type { EvalPlayer } from "../../../../services/seasonPrepEvaluationsService";
import type { PoolPlayer } from "../../SeasonPrep";

function buildEvalPlayers(pool: PoolPlayer[]): EvalPlayer[] {
  return pool
    .filter((p) => p.assignment === "eligible")
    .map((p) => ({
      uniqueId: p.uniqueId,
      name: p.name,
      team: p.team,
      teamCode: p.teamCode,
      position: p.position,
      birthYear: p.birthYear,
      procedencia: p.procedencia,
      manualEntry: p.manualEntry,
      evaluation: p.evaluation,
      recruitmentStatus: p.recruitmentStatus,
      starter: p.matches?.starter,
      totalGoals: p.matches?.totalGoals,
    }));
}

/**
 * Handles debounce auto-save and explicit save of evaluations.
 * Returns saving state and a saveNow function.
 */
export function useEvaluationPersistence(
  pool: PoolPlayer[],
  fedSeason: string,
  loading: boolean
) {
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoaded = useRef(false);

  // Debounce auto-save on pool changes after initial load
  useEffect(() => {
    if (loading) return;
    if (!hasLoaded.current) { hasLoaded.current = true; return; }
    if (!fedSeason) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      upsertSeasonPrepEvaluations(fedSeason, buildEvalPlayers(pool)).catch(() => {});
    }, 800);
  }, [pool, fedSeason, loading]);

  async function saveNow(): Promise<void> {
    if (!fedSeason) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving(true);
    try {
      await upsertSeasonPrepEvaluations(fedSeason, buildEvalPlayers(pool));
    } finally {
      setSaving(false);
    }
  }

  return { saving, saveNow };
}
