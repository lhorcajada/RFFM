import type { CreateExerciseRequest, Exercise, ExerciseTeam } from "../../../types/training";
import { emptyExercise } from "./constants";

const isBlank = (value: string | null | undefined): boolean => (value ?? "").trim() === "";

const keepNonBlank = (lines: string[]): string[] => lines.filter((line) => !isBlank(line));

function cleanTeam(team: ExerciseTeam): ExerciseTeam {
  return {
    color: team.color,
    nombre: team.nombre.trim(),
    cantidad: team.cantidad,
    roles: isBlank(team.roles) ? null : team.roles,
    objetivos: keepNonBlank(team.objetivos),
  };
}

const isEmptyTeam = (team: ExerciseTeam): boolean =>
  team.color === null && team.nombre === "" && team.cantidad === null && team.roles === null && team.objetivos.length === 0;

/** Drops what the coach left blank in the sheet fields before saving: empty lines, empty teams and
 * a blank space become nothing instead of empty entries. */
export function cleanSheetFields<T extends CreateExerciseRequest>(request: T): T {
  return {
    ...request,
    espacio: isBlank(request.espacio) ? null : request.espacio,
    secuencia: keepNonBlank(request.secuencia),
    reglas: keepNonBlank(request.reglas),
    queSeVe: keepNonBlank(request.queSeVe),
    jugadores: request.jugadores.map(cleanTeam).filter((team) => !isEmptyTeam(team)),
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
    porteros: exercise.porteros ?? null,
    dibujo: exercise.dibujo ?? null,
    descripcion: exercise.descripcion,
    boardStateJson: exercise.boardStateJson ?? null,
    espacio: exercise.espacio ?? null,
    turnoMinutos: exercise.turnoMinutos ?? null,
    nivelDibujo: hasEnoughNiveles ? (exercise.nivelDibujo ?? null) : null,
    secuencia: exercise.secuencia ?? [],
    reglas: exercise.reglas ?? [],
    queSeVe: exercise.queSeVe ?? [],
    jugadores: (exercise.jugadores ?? []).map((team) => ({ ...team, objetivos: [...team.objetivos] })),
  };
}
