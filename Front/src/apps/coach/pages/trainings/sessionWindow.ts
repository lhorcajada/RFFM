import trainingService from "../../services/trainingService";
import teamplayerService, { type PlayerResponse } from "../../services/teamplayerService";
import type { Exercise, SessionTargetDetail } from "../../types/training";
import { buildExercisePrintHtml } from "./exercisePrint";
import { buildSessionPrintHtml, listSessionSheets } from "./sessionPrint";
import { buildModeloDeJuegoLine, loadActiveGameModel, resolveSessionObjectives } from "./sessionGameModel";
import { findOverflowingSheets, type SheetOverflow, type SheetToCheck } from "./sheetMeasure";
import { hasBoardObjects, tryParseBoardSnapshot } from "../../components/TacticalBoardSnapshotPreview";

export async function waitForPrintWindowReady(printWindow: Window) {
  if (printWindow.document.readyState !== "complete") {
    await new Promise<void>((resolve) => {
      const handleLoad = () => {
        printWindow.removeEventListener("load", handleLoad);
        resolve();
      };

      printWindow.addEventListener("load", handleLoad);
    });
  }

  const images = Array.from(printWindow.document.images ?? []);
  await Promise.all(
    images.map(
      (image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
    ),
  );

  if (printWindow.document.fonts?.ready) {
    await printWindow.document.fonts.ready.catch(() => undefined);
  }

  await new Promise<void>((resolve) => {
    printWindow.requestAnimationFrame(() => {
      printWindow.requestAnimationFrame(() => resolve());
    });
  });
}

/** Called with the sheets that do not fit one page before anything is printed. Resolves `true` when
 * the coach chooses to print anyway and `false` when they edit an exercise or cancel. */
export type OverflowHandler = (overflowing: SheetOverflow[]) => Promise<boolean>;

export type PrintOptions = {
  /** Asks the coach what to do when a sheet does not fit. Without it, printing goes ahead. */
  onOverflow?: OverflowHandler;
};

/** Runs the fit check for every sheet and, when some do not fit, asks before going on. */
async function confirmFit(sheets: SheetToCheck[], options: PrintOptions | undefined): Promise<boolean> {
  const overflowing = findOverflowingSheets(sheets);
  if (overflowing.length === 0 || !options?.onOverflow) return true;
  return options.onOverflow(overflowing);
}

/** Fetch the roster once for the whole print — only exercises without an uploaded image need the
 * tactical-board drawing rendered, and they all share the same team. */
async function loadPlayersById(exercises: Exercise[], teamId: string): Promise<Map<string, PlayerResponse>> {
  const needsBoardDrawing = exercises.some(
    (exercise) => !exercise.urlImage && hasBoardObjects(tryParseBoardSnapshot(exercise.boardStateJson)),
  );
  if (!needsBoardDrawing || !teamId) return new Map();
  try {
    const players = await teamplayerService.getPlayersByTeam(teamId);
    return new Map(players.filter((p) => p.id).map((p) => [p.id, p]));
  } catch {
    // Swallowed: the board drawing falls back to anonymous-style dorsal/alias.
    return new Map();
  }
}

/** The session's game-model objectives as the header line of its sheets. A session without
 * objectives needs no catalog and prints no line (E5). */
async function loadModeloDeJuegoLine(targets: SessionTargetDetail[], teamId: string): Promise<string> {
  if (targets.length === 0 || !teamId) return "";
  return buildModeloDeJuegoLine(resolveSessionObjectives(targets, await loadActiveGameModel(teamId)));
}

async function openPrintWindow(html: string, print: boolean) {
  const printWindow = window.open("", "_blank", "width=1200,height=900");
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  if (!print) return;

  try {
    await waitForPrintWindowReady(printWindow);
  } catch {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 300);
    });
  }

  printWindow.focus();
  printWindow.print();
}

/** Opens one exercise's landscape A4 sheet in a new window and prints it. The fit check runs
 * first and, when the sheet does not fit, the coach decides through `onOverflow` (E13). */
export async function printExerciseSheet(exercise: Exercise, teamId: string, options?: PrintOptions) {
  if (!(await confirmFit([{ exercise }], options))) return;

  const playersById = await loadPlayersById([exercise], teamId);
  await openPrintWindow(buildExercisePrintHtml(exercise, { playersById }), true);
}

/** Opens a session's read-only sheets (same HTML as the print sheets — see `sessionPrint.ts`) in a
 * new window. Pass `{ print: true }` to also trigger the browser's print dialog; the fit check then
 * runs for every sheet before the window opens (E13). */
export async function openSessionWindow(
  sessionId: string,
  teamId: string,
  options?: PrintOptions & { print?: boolean },
) {
  const session = await trainingService.getSessionById(sessionId);

  const exerciseIds = Array.from(
    new Set(session.blocks.flatMap((block) => block.exercises.map((ex) => ex.exerciseId))),
  );
  const exercises = await Promise.all(exerciseIds.map((id) => trainingService.getExerciseById(id)));
  const exercisesById = new Map(
    exercises.filter((exercise): exercise is Exercise => exercise !== null).map((exercise) => [exercise.id, exercise]),
  );

  const modeloDeJuego = await loadModeloDeJuegoLine(session.targets, teamId);

  if (options?.print && !(await confirmFit(listSessionSheets(session, exercisesById, modeloDeJuego), options))) return;

  const playersById = await loadPlayersById([...exercisesById.values()], teamId);
  await openPrintWindow(buildSessionPrintHtml(session, exercisesById, playersById, modeloDeJuego), options?.print === true);
}
