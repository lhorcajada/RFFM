import { useCallback, useEffect, useState } from "react";
import gameModelService from "../../../../services/gameModelService";
import trainingService from "../../../../services/trainingService";
import type { GameModel } from "../../../../types/gameModel";
import type { AdnCoverage } from "../../../../types/adnCoverage";
import type { TrainingSession } from "../../../../types/training";

/** Loads the three data sources the content-board needs — the team's GameModel tree (left
 * panel), its ADN coverage/usage report (checkmarks + badges), and its TrainingSessions (right
 * panel board, `date === null` subset) — design.md F3 of `season-plan-content-board`.
 * `refetchSessions`/`refetchCoverage` are called independently after a target write (F5): the
 * session list updates optimistically first (cheap, instant), coverage is simply refetched
 * (cheap read, no optimistic-update value). */
export function useContentBoardData(teamId: string, season: string) {
  const [gameModel, setGameModel] = useState<GameModel | null>(null);
  const [coverage, setCoverage] = useState<AdnCoverage | null>(null);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchSessions = useCallback(async () => {
    if (!teamId) return;
    const result = await trainingService.getSessions(teamId);
    setSessions(result);
  }, [teamId]);

  const refetchCoverage = useCallback(async () => {
    if (!teamId || !season) return;
    const result = await gameModelService.getAdnCoverage(teamId, season);
    setCoverage(result);
  }, [teamId, season]);

  useEffect(() => {
    if (!teamId || !season) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      gameModelService.getByTeamIdAndSeason(teamId, season),
      gameModelService.getAdnCoverage(teamId, season),
      trainingService.getSessions(teamId),
    ])
      .then(([modelResult, coverageResult, sessionsResult]) => {
        if (cancelled) return;
        setGameModel(modelResult);
        setCoverage(coverageResult);
        setSessions(sessionsResult);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Error al cargar el tablero de contenido.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId, season]);

  return { gameModel, coverage, sessions, setSessions, loading, error, refetchSessions, refetchCoverage };
}
