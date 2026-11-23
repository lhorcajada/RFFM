import { useEffect, useMemo, useState } from "react";
import type { GameModel } from "../../../types/gameModel";
import type { TrainingSessionDetail } from "../../../types/training";
import { loadActiveGameModel } from "../../trainings/sessionGameModel";
import { habilidadesBySubprincipio } from "../utils/sessionHabilidades";

const NO_HABILIDADES = new Map<string, string[]>();

/** Habilidades de los objetivos de la sesión según el modelo de juego del equipo, por subprincipio. */
export function useSessionHabilidades(teamId: string, detail: TrainingSessionDetail | null): Map<string, string[]> {
  const [model, setModel] = useState<GameModel | null>(null);
  const hasTargets = (detail?.targets.length ?? 0) > 0;

  useEffect(() => {
    setModel(null);
    if (!teamId || !hasTargets) return;
    let cancelled = false;
    loadActiveGameModel(teamId).then((loaded) => {
      if (!cancelled) setModel(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [teamId, hasTargets]);

  return useMemo(
    () => (detail && model ? habilidadesBySubprincipio(detail.targets, model) : NO_HABILIDADES),
    [detail, model],
  );
}
