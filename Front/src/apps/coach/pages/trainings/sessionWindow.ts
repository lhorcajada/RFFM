import trainingService from "../../services/trainingService";
import teamplayerService, { type PlayerResponse } from "../../services/teamplayerService";
import type { Exercise } from "../../types/training";
import { buildSessionPrintHtml } from "./sessionPrint";
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

/** Opens a session's read-only sheet (same HTML as the print sheet — see `sessionPrint.ts`) in
 * a new window. Pass `{ print: true }` to also trigger the browser's print dialog, following
 * the exact same "browser-native print, no jsPDF/html2canvas" pattern as `printExercise`. */
export async function openSessionWindow(sessionId: string, teamId: string, options?: { print?: boolean }) {
  const session = await trainingService.getSessionById(sessionId);

  const exerciseIds = Array.from(
    new Set(session.blocks.flatMap((block) => block.exercises.map((ex) => ex.exerciseId))),
  );
  const exercises = await Promise.all(exerciseIds.map((id) => trainingService.getExerciseById(id)));
  const exercisesById = new Map(
    exercises.filter((exercise): exercise is Exercise => exercise !== null).map((exercise) => [exercise.id, exercise]),
  );

  // Only the exercises without an uploaded image need the tactical-board drawing rendered —
  // fetch the roster once for the whole session (all its exercises share the same team)
  // rather than once per exercise.
  const needsBoardDrawing = [...exercisesById.values()].some(
    (exercise) => !exercise.urlImage && hasBoardObjects(tryParseBoardSnapshot(exercise.boardStateJson)),
  );
  let playersById = new Map<string, PlayerResponse>();
  if (needsBoardDrawing && teamId) {
    try {
      const players = await teamplayerService.getPlayersByTeam(teamId);
      playersById = new Map(players.filter((p) => p.id).map((p) => [p.id, p]));
    } catch {
      // Swallowed: the board drawing falls back to anonymous-style dorsal/alias.
    }
  }

  const html = buildSessionPrintHtml(session, exercisesById, playersById);

  const printWindow = window.open("", "_blank", "width=980,height=1200");
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  if (!options?.print) return;

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
