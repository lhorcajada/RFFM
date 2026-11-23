import gameModelService from "../../services/gameModelService";
import seasonService from "../../services/seasonService";
import type { GameModel } from "../../types/gameModel";
import type { SessionTargetDetail } from "../../types/training";

/** A session objective found in the game-model catalog, with the habilidades the catalog defines for it. */
export type ResolvedObjective = {
  subSubPrincipioId: string;
  numero: string;
  rol: string;
  subprincipioId: string;
  habilidades: string[];
};

/** The team's game model for the active season, or null when it has none or cannot be read. */
export async function loadActiveGameModel(teamId: string): Promise<GameModel | null> {
  try {
    const activeSeason = await seasonService.getActiveSeason();
    const seasonLabel = activeSeason?.name ?? activeSeason?.id;
    return seasonLabel ? await gameModelService.getByTeamIdAndSeason(teamId, seasonLabel) : null;
  } catch {
    return null;
  }
}

function indexSubSubPrincipios(model: GameModel): Map<string, ResolvedObjective> {
  const index = new Map<string, ResolvedObjective>();
  for (const principle of model.principles) {
    for (const subprincipio of principle.subprincipios) {
      if (!subprincipio.apiId) continue;
      const subSubPrincipios = [...subprincipio.subSubPrincipios, ...subprincipio.zonas.flatMap((zona) => zona.subSubPrincipios)];
      for (const item of subSubPrincipios) {
        if (!item.apiId) continue;
        index.set(item.apiId, {
          subSubPrincipioId: item.apiId,
          numero: item.numero,
          rol: item.rol,
          subprincipioId: subprincipio.apiId,
          habilidades: item.habilidades.map((habilidad) => habilidad.nombre),
        });
      }
    }
  }
  return index;
}

/** The objectives of a session (its targets) as the catalog knows them, in the session's order.
 * An objective the catalog no longer resolves is skipped (E9). */
export function resolveSessionObjectives(targets: SessionTargetDetail[], model: GameModel | null): ResolvedObjective[] {
  if (!model) return [];
  const index = indexSubSubPrincipios(model);
  return targets.flatMap((target) => {
    const objective = index.get(target.subSubPrincipioId);
    return objective ? [objective] : [];
  });
}

/** One compact line with the session's objectives for the sheet header; empty when it has none. */
export function buildModeloDeJuegoLine(objectives: ResolvedObjective[]): string {
  return objectives.map((objective) => `${objective.numero} ${objective.rol}`).join(" · ");
}
