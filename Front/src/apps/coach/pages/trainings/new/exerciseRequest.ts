import type { CreateExerciseRequest, Exercise } from "../../../types/training";
import { emptyExercise } from "./constants";

/** Maps a saved exercise to the request used to create/edit one. Exercises with fewer than two
 * niveles fall back to the empty niveles grid, as the exercise editor requires 2-5 rows. */
export function exerciseToRequest(exercise: Exercise, clubId: string): CreateExerciseRequest {
  const hasEnoughNiveles = (exercise.niveles?.length ?? 0) >= 2;
  return {
    clubId,
    name: exercise.name,
    tipo: exercise.tipo,
    subtipo: exercise.subtipo ?? null,
    objetivo: exercise.objetivo,
    objetivoPorRol: exercise.objetivoPorRol ?? null,
    modelRelations: (exercise.modelRelations ?? []).map((r) => ({
      subprincipioId: r.subprincipioId,
      isFoco: r.isFoco,
      habilidadesImprescindibles: r.habilidadesImprescindibles ?? [],
      items: (r.items ?? []).map((it) => ({
        subSubPrincipioId: it.subSubPrincipioId,
        isFoco: it.isFoco,
        habilidades: it.habilidades ?? [],
      })),
    })),
    ...(hasEnoughNiveles
      ? { nivelesColumnas: exercise.nivelesColumnas ?? [], niveles: exercise.niveles ?? [] }
      : { nivelesColumnas: emptyExercise.nivelesColumnas, niveles: emptyExercise.niveles }),
    logistica: exercise.logistica,
    durationMinutes: exercise.durationMinutes ?? null,
    porteros: exercise.porteros ?? null,
    dibujo: exercise.dibujo ?? null,
    descripcion: exercise.descripcion,
    boardStateJson: exercise.boardStateJson ?? null,
  };
}
