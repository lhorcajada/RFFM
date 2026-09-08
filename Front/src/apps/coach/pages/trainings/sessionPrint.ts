import { renderToStaticMarkup } from "react-dom/server";
import type { Exercise, SessionBlockExercise, TrainingSessionDetail } from "../types/training";
import type { PlayerResponse } from "../../services/teamplayerService";
import { buildTargetTree } from "./season-plan/components/targetTreeGrouping";
import { buildImageOrBoardHtml, buildModelRelationsHtml, buildNivelesTableHtml, escapeHtml } from "./exercisePrint";
import {
  TacticalBoardSnapshotPreviewStatic,
  hasBoardObjects,
  tryParseBoardSnapshot,
} from "../../components/TacticalBoardSnapshotPreview";
import boardPreviewCss from "../../components/TacticalBoardSnapshotPreview.module.css?inline";

function formatDate(iso: string | null): string {
  if (!iso) return "Sin fecha (sin programar)";
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

function formatTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

function buildScheduleLine(session: TrainingSessionDetail): string {
  const parts = [formatDate(session.date)];
  const time = formatTime(session.startTime) + (session.endTime ? ` – ${formatTime(session.endTime)}` : "");
  if (time) parts.push(time);
  if (session.location) parts.push(session.location);
  return parts.map(escapeHtml).join(" · ");
}

/** When an exercise has no uploaded image but has tactical-board content, render the actual
 * board drawing — same markup/styles as the live `TacticalBoardSnapshotPreview` — via
 * `renderToStaticMarkup`, so it doesn't need to be mounted anywhere on screen (unlike
 * `exercisePrint.ts`'s single-exercise print, which captures an already-mounted preview's
 * `outerHTML` — see `ExerciseCromo.tsx`'s `handlePrint`). */
function buildImageOrBoardNoteHtml(exercise: Exercise, playersById: Map<string, PlayerResponse>): string {
  if (exercise.urlImage) return buildImageOrBoardHtml(exercise);

  const snapshot = tryParseBoardSnapshot(exercise.boardStateJson);
  if (!hasBoardObjects(snapshot) || !snapshot) return "";

  const boardHtml = renderToStaticMarkup(
    TacticalBoardSnapshotPreviewStatic({ snapshot, playersById }),
  );
  return buildImageOrBoardHtml(exercise, `<style>${boardPreviewCss}</style>${boardHtml}`);
}

/** Renders one exercise's full content (objetivo, relación con el modelo de juego, niveles,
 * imagen/pizarra) when the full `Exercise` was fetched for it, falling back to the summary
 * already embedded in the session (`SessionBlockExercise`) otherwise. */
function buildExerciseDetailHtml(
  ex: SessionBlockExercise,
  exercise: Exercise | undefined,
  playersById: Map<string, PlayerResponse>,
): string {
  const meta = typeof ex.exerciseDurationMinutes === "number" ? ` (${ex.exerciseDurationMinutes} min)` : "";
  const name = ex.exerciseName ?? exercise?.name ?? "Ejercicio";

  if (!exercise) {
    return `<li class="exercise-item"><h4>${escapeHtml(name)}${escapeHtml(meta)}</h4></li>`;
  }

  return `<li class="exercise-item">
    <h4>${escapeHtml(name)}${escapeHtml(meta)}</h4>
    ${exercise.objetivo ? `<p class="exercise-objetivo">${escapeHtml(exercise.objetivo)}</p>` : ""}
    ${buildModelRelationsHtml(exercise)}
    ${buildNivelesTableHtml(exercise)}
    ${buildImageOrBoardNoteHtml(exercise, playersById)}
  </li>`;
}

function buildBlocksHtml(
  session: TrainingSessionDetail,
  exercisesById: Map<string, Exercise>,
  playersById: Map<string, PlayerResponse>,
): string {
  if (session.blocks.length === 0) return "";

  const sortedBlocks = [...session.blocks].sort((a, b) => a.order - b.order);
  const blocksHtml = sortedBlocks
    .map((block) => {
      const exercisesHtml = [...block.exercises]
        .sort((a, b) => a.position - b.position)
        .map((ex) => buildExerciseDetailHtml(ex, exercisesById.get(ex.exerciseId), playersById))
        .join("");

      return `<div class="block">
        <h3>${escapeHtml(block.nombre)}</h3>
        ${block.comoConectaConAnterior ? `<p class="connector"><strong>Conexión con el bloque anterior:</strong> ${escapeHtml(block.comoConectaConAnterior)}</p>` : ""}
        ${block.rotacionEntreEjercicios ? `<p class="connector"><strong>Rotación entre ejercicios:</strong> ${escapeHtml(block.rotacionEntreEjercicios)}</p>` : ""}
        ${exercisesHtml ? `<ul class="exercise-list">${exercisesHtml}</ul>` : ""}
      </div>`;
    })
    .join("");

  return `<div class="section"><h2>Bloques</h2>${blocksHtml}</div>`;
}

function buildTargetsHtml(session: TrainingSessionDetail): string {
  if (session.targets.length === 0) return "";

  const fases = buildTargetTree(session.targets);
  const fasesHtml = fases
    .map((fase) => {
      const principiosHtml = fase.principios
        .map((principio) => {
          const subprincipiosHtml = principio.subprincipios
            .map((sp) => {
              const directLeaves = sp.leaves
                .map((leaf) => `<span class="chip">${escapeHtml(`${leaf.target.rol} (${leaf.target.numero})`)}</span>`)
                .join("");
              const zonasHtml = sp.zonas
                .map((zona) => {
                  const zonaLeaves = zona.leaves
                    .map((leaf) => `<span class="chip">${escapeHtml(`${leaf.target.rol} (${leaf.target.numero})`)}</span>`)
                    .join("");
                  return `<div class="zona"><span class="zona-label">${escapeHtml(zona.zonaLabel)}</span><div class="chips">${zonaLeaves}</div></div>`;
                })
                .join("");
              return `<div class="subprincipio">
                <h4>${escapeHtml(sp.subprincipioTitulo)}</h4>
                ${directLeaves ? `<div class="chips">${directLeaves}</div>` : ""}
                ${zonasHtml}
              </div>`;
            })
            .join("");
          return `<div class="principio"><h3>${escapeHtml(principio.principioTitulo)}</h3>${subprincipiosHtml}</div>`;
        })
        .join("");
      return `<div class="fase"><h2>${escapeHtml(fase.gameMomentName)}</h2>${principiosHtml}</div>`;
    })
    .join("");

  return `<div class="section"><h2>Objetivos ADN</h2>${fasesHtml}</div>`;
}

/** Builds the print-friendly / read-only HTML sheet for a training session, following the same
 * "browser-native print, no jsPDF/html2canvas" approach as `buildExercisePrintHtml`
 * (`exercisePrint.ts`): the caller opens this HTML in a new window either to let the coach read
 * it (no `.print()` call) or to trigger the browser's print dialog (`.print()`), which the
 * coach can save as PDF — see `Trainings.tsx`'s `viewSession`/`printSession`. */
export function buildSessionPrintHtml(
  session: TrainingSessionDetail,
  exercisesById: Map<string, Exercise> = new Map(),
  playersById: Map<string, PlayerResponse> = new Map(),
): string {
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(session.name)} - Sesión</title>
      <style>
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #102133; background: #fff; }
        .sheet { display: flex; flex-direction: column; gap: 14px; }
        .header { display: flex; flex-direction: column; gap: 6px; }
        .title { margin: 0; font-size: 24px; line-height: 1.1; }
        .schedule { font-size: 13px; color: #38506b; }
        .pill { display: inline-flex; align-items: center; border: 1px solid #c9d8e6; border-radius: 999px; padding: 4px 10px; background: #f6f9fc; font-size: 12px; margin-top: 4px; }
        .section h2 { margin: 18px 0 8px; font-size: 15px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #c9d8e6; padding-bottom: 4px; }
        .section p { margin: 0 0 8px; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
        .block { border: 1px solid #c9d8e6; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px; }
        .block h3 { margin: 0 0 6px; font-size: 14px; }
        .connector { font-size: 12px; color: #38506b; }
        .exercise-list { margin: 6px 0 0; padding-left: 18px; font-size: 13px; }
        .fase h2 { font-size: 14px; margin: 12px 0 6px; border: none; text-transform: none; }
        .principio h3 { font-size: 13px; margin: 8px 0 4px; }
        .subprincipio h4 { font-size: 12px; margin: 6px 0 4px; color: #38506b; }
        .zona { margin: 4px 0; }
        .zona-label { font-size: 11px; font-weight: bold; color: #38506b; }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0; }
        .chip { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 9px; font-size: 11px; border: 1px solid #c9d8e6; background: #eef2fa; }
        .chip-foco { background: #fde3d0; border-color: #f0a865; }
        .chip-integrado { background: #eef2fa; }
        .chip-habilidad { background: #e7f6ec; border-color: #9bd6ac; }
        .exercise-item { margin-bottom: 12px; }
        .exercise-item h4 { margin: 0 0 4px; font-size: 13px; }
        .exercise-objetivo { font-size: 12px; }
        .exercise-item .section { margin: 6px 0; }
        .exercise-item .section h3, .section h3 { margin: 0 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #38506b; }
        .board-drawing { width: 100%; height: 320px; border-radius: 10px; border: 1px solid #c9d8e6; overflow: hidden; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0; }
        th, td { border: 1px solid #c9d8e6; padding: 4px 6px; text-align: left; }
        th { background: #f6f9fc; }
        .nivel-cell { font-weight: bold; width: 40px; }
        img { display: block; max-width: 100%; border-radius: 10px; border: 1px solid #c9d8e6; margin: 4px 0; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="header">
          <h1 class="title">${escapeHtml(session.name)}</h1>
          <div class="schedule">${buildScheduleLine(session)}</div>
          ${session.sportEventName ? `<span class="pill">${escapeHtml(session.sportEventName)}</span>` : ""}
        </div>

        ${session.objetivoGeneral ? `<div class="section"><h2>Objetivo general</h2><p>${escapeHtml(session.objetivoGeneral)}</p></div>` : ""}
        ${session.mapaCampoTexto ? `<div class="section"><h2>Mapa de campo</h2><p>${escapeHtml(session.mapaCampoTexto)}</p></div>` : ""}
        ${buildBlocksHtml(session, exercisesById, playersById)}
        ${buildTargetsHtml(session)}
      </div>
    </body>
  </html>`;
}
