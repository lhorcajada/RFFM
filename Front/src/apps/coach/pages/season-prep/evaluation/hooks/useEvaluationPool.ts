import { useState, useEffect } from "react";
import { getSeasonPrepSession } from "../../../../services/seasonPrepSessionService";
import { getSeasonPrepEvaluations } from "../../../../services/seasonPrepEvaluationsService";
import type { EvalPlayer } from "../../../../services/seasonPrepEvaluationsService";
import type { PoolPlayer, ConceptEval, RecruitmentStatus } from "../../SeasonPrep";
import type { ConceptKey } from "../evaluationConstants";

/**
 * Loads the eligible player pool from the session and merges saved evaluations.
 * Exposes mutation handlers for eval changes, position changes and adding manual players.
 */
export function useEvaluationPool() {
  const [pool, setPool] = useState<PoolPlayer[]>([]);
  const [fedSeason, setFedSeason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSeasonPrepSession()
      .then(async (saved) => {
        if (!saved) return;
        const s = saved as unknown as { fedSeason: string; slot: object; pool: PoolPlayer[] };
        const season = s.fedSeason ?? "";
        setFedSeason(season);
        const basePlayers: PoolPlayer[] = s.pool ?? [];

        let savedEvals: EvalPlayer[] | null = null;
        try {
          savedEvals = season ? await getSeasonPrepEvaluations(season) : null;
        } catch {
          // non-critical — proceed without saved evaluations
        }

        if (savedEvals && savedEvals.length > 0) {
          const evalMap = new Map(savedEvals.map((e) => [e.uniqueId, e]));

          const merged = basePlayers.map((p) => {
            const ev = evalMap.get(p.uniqueId);
            if (!ev) return p;
            return {
              ...p,
              position: ev.position ?? p.position,
              evaluation: ev.evaluation,
              recruitmentStatus: ev.recruitmentStatus,
              matches: {
                ...(p.matches ?? { called: 0, substitute: 0, played: 0, goalsPerMatch: 0 }),
                starter: ev.starter ?? p.matches?.starter ?? 0,
                totalGoals: ev.totalGoals ?? p.matches?.totalGoals ?? 0,
              },
            };
          });

          const sessionIds = new Set(basePlayers.map((p) => p.uniqueId));
          const manualPlayers: PoolPlayer[] = savedEvals
            .filter((e) => e.manualEntry && !sessionIds.has(e.uniqueId))
            .map((e) => ({
              playerId: e.uniqueId,
              seasonId: "",
              name: e.name,
              age: e.birthYear ? new Date().getFullYear() - e.birthYear : 0,
              birthYear: e.birthYear ?? 0,
              team: e.team ?? e.procedencia ?? "",
              teamCode: e.teamCode ?? "",
              teamCategory: "",
              jerseyNumber: "",
              position: e.position ?? "",
              isGoalkeeper: false,
              photoUrl: "",
              teamShieldUrl: "",
              matches: { called: 0, starter: e.starter ?? 0, substitute: 0, played: 0, totalGoals: e.totalGoals ?? 0, goalsPerMatch: 0 },
              cards: { yellow: 0, red: 0, doubleYellow: 0 },
              competitions: [],
              uniqueId: e.uniqueId,
              assignment: "eligible" as const,
              manualEntry: true,
              procedencia: e.procedencia,
              evaluation: e.evaluation,
              recruitmentStatus: e.recruitmentStatus,
            }));

          setPool([...merged, ...manualPlayers]);
        } else {
          setPool(basePlayers);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleEvalChange(
    uniqueId: string,
    key: ConceptKey | "notes",
    val: ConceptEval | string
  ) {
    setPool((prev) =>
      prev.map((p) => {
        if (p.uniqueId !== uniqueId) return p;
        return { ...p, evaluation: { ...(p.evaluation ?? {}), [key]: val } };
      })
    );
  }

  function handlePositionChange(uniqueId: string, pos: string) {
    setPool((prev) =>
      prev.map((p) => (p.uniqueId === uniqueId ? { ...p, position: pos } : p))
    );
  }

  function handleStatusChange(uniqueId: string, status: RecruitmentStatus) {
    setPool((prev) =>
      prev.map((p) => (p.uniqueId === uniqueId ? { ...p, recruitmentStatus: status } : p))
    );
  }

  function handleAddPlayer(data: {
    name: string;
    procedencia: string;
    birthYear: number;
    position: string;
  }): PoolPlayer {
    const existing = pool.find(
      (p) => p.name.trim().toLowerCase() === data.name.trim().toLowerCase()
    );
    if (existing) return existing;

    const uid = `manual-${Date.now()}`;
    const newPlayer: PoolPlayer = {
      playerId: uid,
      seasonId: "",
      name: data.name,
      age: new Date().getFullYear() - data.birthYear,
      birthYear: data.birthYear,
      team: data.procedencia,
      teamCode: "",
      teamCategory: "",
      jerseyNumber: "",
      position: data.position,
      isGoalkeeper: false,
      photoUrl: "",
      teamShieldUrl: "",
      matches: { called: 0, starter: 0, substitute: 0, played: 0, totalGoals: 0, goalsPerMatch: 0 },
      cards: { yellow: 0, red: 0, doubleYellow: 0 },
      competitions: [],
      uniqueId: uid,
      assignment: "eligible",
      manualEntry: true,
      procedencia: data.procedencia,
    };
    setPool((prev) => [...prev, newPlayer]);
    return newPlayer;
  }

  return {
    pool,
    setPool,
    fedSeason,
    loading,
    handleEvalChange,
    handlePositionChange,
    handleStatusChange,
    handleAddPlayer,
  };
}
