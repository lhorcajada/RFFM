import type { Exercise, SessionBlockExercise, TrainingSessionDetail } from "../../types/training";
import type { PlayerResponse } from "../../services/teamplayerService";
import { buildExerciseSheetHtml, buildPrintDocument } from "./exercisePrint";
import { escapeHtml } from "./printHtml";
import type { SheetToCheck } from "./sheetMeasure";

/** Placeholder for a session exercise whose full record could not be loaded (e.g. it was deleted):
 * its sheet still takes a page and shows the name the session kept. */
function summaryExercise(ex: SessionBlockExercise): Exercise {
  return {
    id: ex.exerciseId,
    name: ex.name ?? ex.exerciseName ?? "Ejercicio",
    tipo: ex.tipo ?? ex.exerciseTipo ?? "Analitico",
    objetivo: ex.objetivo ?? ex.exerciseObjetivo ?? "",
    durationMinutes: ex.durationMinutes ?? ex.exerciseDurationMinutes ?? null,
    nivelesColumnas: [],
    niveles: [],
    logistica: "",
    descripcion: "",
  };
}

/** The sheets of a session in print order: blocks by `order`, exercises by `position` inside each
 * block. A repeated exercise appears once per occurrence, so it gets its own page (E7). Every sheet
 * carries the session's game-model line (E5). */
export function listSessionSheets(
  session: TrainingSessionDetail,
  exercisesById: Map<string, Exercise>,
  modeloDeJuego = "",
): Required<SheetToCheck>[] {
  return [...session.blocks]
    .sort((a, b) => a.order - b.order)
    .flatMap((block) =>
      [...block.exercises]
        .sort((a, b) => a.position - b.position)
        .map((ex) => ({
          exercise: exercisesById.get(ex.exerciseId) ?? summaryExercise(ex),
          blockName: block.nombre,
          modeloDeJuego,
        })),
    );
}

/** Builds the print-friendly / read-only document for a training session: one landscape A4 sheet
 * per exercise, with no cover or summary page, each with the session name and its block in the
 * footer (E7, E8) and the session's game-model objectives as one line in the header (E5). Same
 * "browser-native print, no jsPDF/html2canvas" approach as
 * `buildExercisePrintHtml`: the caller opens it in a new window, to read it or to print it. */
export function buildSessionPrintHtml(
  session: TrainingSessionDetail,
  exercisesById: Map<string, Exercise> = new Map(),
  playersById: Map<string, PlayerResponse> = new Map(),
  modeloDeJuego = "",
): string {
  const sheets = listSessionSheets(session, exercisesById, modeloDeJuego)
    .map(({ exercise, blockName }) =>
      buildExerciseSheetHtml(exercise, {
        playersById,
        modeloDeJuego,
        footer: `Sesión: ${session.name} · Bloque: ${blockName}`,
      }),
    )
    .join("");

  const body = sheets || `<p style="font-family:Arial,sans-serif;padding:8mm">${escapeHtml("Esta sesión no tiene ejercicios.")}</p>`;
  return buildPrintDocument(`${session.name} - Sesión`, body);
}
