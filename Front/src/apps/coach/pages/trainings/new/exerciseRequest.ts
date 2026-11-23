import type { CreateExerciseRequest, Exercise } from "../../../types/training";
import { emptyExercise } from "./constants";

const isBlank = (value: string | null | undefined): boolean => (value ?? "").trim() === "";

const keepNonBlank = (lines: string[]): string[] => lines.filter((line) => !isBlank(line));

/** Drops what the coach left blank in the sheet fields before saving: empty lines and a blank
 * space become nothing instead of empty entries. */
export function cleanSheetFields<T extends CreateExerciseRequest>(request: T): T {
  return {
    ...request,
    espacio: isBlank(request.espacio) ? null : request.espacio,
    reglas: keepNonBlank(request.reglas),
    puntos: keepNonBlank(request.puntos),
    rotaciones: keepNonBlank(request.rotaciones),
    montaje: keepNonBlank(request.montaje),
  };
}

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
    ...(hasEnoughNiveles
      ? { nivelesColumnas: exercise.nivelesColumnas ?? [], niveles: exercise.niveles ?? [] }
      : { nivelesColumnas: emptyExercise.nivelesColumnas, niveles: emptyExercise.niveles }),
    logistica: exercise.logistica,
    durationMinutes: exercise.durationMinutes ?? null,
    dibujo: exercise.dibujo ?? null,
    descripcion: exercise.descripcion,
    boardStateJson: exercise.boardStateJson ?? null,
    espacio: exercise.espacio ?? null,
    turnoMinutos: exercise.turnoMinutos ?? null,
    nivelDibujo: hasEnoughNiveles ? (exercise.nivelDibujo ?? null) : null,
    reglas: [...(exercise.reglas ?? [])],
    puntos: [...(exercise.puntos ?? [])],
    rotaciones: [...(exercise.rotaciones ?? [])],
    montaje: [...(exercise.montaje ?? [])],
  };
}
