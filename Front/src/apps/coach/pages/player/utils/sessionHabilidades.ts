import type { GameModel } from "../../../types/gameModel";
import type { SessionTargetDetail } from "../../../types/training";
import { resolveSessionObjectives } from "../../trainings/sessionGameModel";

/** Habilidades que el modelo de juego define para los objetivos de la sesión, agrupadas por el
 * subprincipio al que pertenecen, sin repetir y en orden de aparición. Un objetivo que el modelo ya
 * no resuelve se ignora; una sesión sin objetivos no tiene habilidades. */
export function habilidadesBySubprincipio(
  targets: SessionTargetDetail[],
  model: GameModel | null,
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const objective of resolveSessionObjectives(targets, model)) {
    const current = result.get(objective.subprincipioId) ?? [];
    for (const habilidad of objective.habilidades) {
      if (!current.includes(habilidad)) current.push(habilidad);
    }
    if (current.length > 0) result.set(objective.subprincipioId, current);
  }
  return result;
}
