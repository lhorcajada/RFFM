import type { Exercise } from "../../../types/training";

/** Habilidades imprescindibles de los ejercicios de la sesión, agrupadas por el subprincipio al que se
 * relacionan, sin repetir y en orden de aparición. */
export function habilidadesBySubprincipio(exercises: Exercise[]): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const exercise of exercises) {
    for (const relation of exercise.modelRelations) {
      const current = result.get(relation.subprincipioId) ?? [];
      for (const habilidad of relation.habilidadesImprescindibles) {
        if (!current.includes(habilidad)) current.push(habilidad);
      }
      if (current.length > 0) result.set(relation.subprincipioId, current);
    }
  }
  return result;
}
