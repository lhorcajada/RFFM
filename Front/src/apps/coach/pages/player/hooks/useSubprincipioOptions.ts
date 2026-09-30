import { useEffect, useState } from "react";
import gameModelService from "../../../services/gameModelService";
import seasonService from "../../../services/seasonService";
import type { GameModel } from "../../../types/gameModel";

export type SubprincipioOption = {
  id: string;
  label: string;
  group: string;
};

function toOptions(model: GameModel): SubprincipioOption[] {
  return model.principles.flatMap((principle) =>
    principle.subprincipios
      .filter((sub) => !!sub.apiId)
      .map((sub) => ({
        id: sub.apiId as string,
        label: `${sub.numero} ${sub.titulo}`,
        group: `${principle.gameMomentName ?? ""} › ${principle.numero}. ${principle.titulo}`,
      })),
  );
}

/** Subprincipios del modelo de juego del equipo en la temporada activa, para el alta de observaciones. */
export function useSubprincipioOptions(teamId: string | undefined) {
  const [options, setOptions] = useState<SubprincipioOption[]>([]);
  const [hasModel, setHasModel] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;

    async function load() {
      const activeSeason = await seasonService.getActiveSeason();
      const seasonLabel = activeSeason?.name ?? activeSeason?.id;
      const model = seasonLabel ? await gameModelService.getByTeamIdAndSeason(teamId as string, seasonLabel) : null;
      if (cancelled) return;
      setHasModel(!!model);
      setOptions(model ? toOptions(model) : []);
    }

    setLoading(true);
    load()
      .catch(() => {
        if (cancelled) return;
        setHasModel(false);
        setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return { options, hasModel, loading };
}
