import type { Exercise } from "../../types/training";
import type { PlayersById } from "../../components/TacticalBoardSnapshotPreview";
import {
  BOARD_PRINT_CSS,
  SHEET_CSS,
  SHEET_GEOMETRY,
  buildMaterialLegendHtml,
  buildSheetDrawing,
  buildSheetPanelHtml,
  buildSheetSubtitle,
  collectMaterialLegend,
  legendFreeHeightMm,
  sheetContentFromExercise,
} from "./exerciseSheet";
import { escapeHtml } from "./printHtml";
import { legendFits } from "./sheetMeasure";
import { SUBTIPO_LABELS, TIPO_LABELS } from "./exerciseTypeLabels";

export { escapeHtml, mediaUrl } from "./printHtml";

export type SheetOptions = {
  /** Resolved roster (dorsal/alias) for the chapas of the board drawing. */
  playersById?: PlayersById;
  /** Text of the sheet footer; the single-exercise sheet has none. */
  footer?: string;
};

/** One landscape A4 page for an exercise, in the reference layout: the drawing on the left, the
 * fixed side panel on the right and the footer under both. The panel is clipped to its fixed
 * height, so content that does not fit is cut (the fit check warns before that happens). */
export function buildExerciseSheetHtml(exercise: Exercise, options: SheetOptions = {}): string {
  const { playersById = new Map(), footer = "" } = options;
  const content = sheetContentFromExercise(exercise);
  const drawing = buildSheetDrawing(exercise, playersById);

  const legendItems = drawing.viewport ? collectMaterialLegend(exercise) : [];
  const legendHtml = legendItems.length > 0 && drawing.viewport ? buildMaterialLegendHtml(legendItems) : "";
  const showLegend = legendHtml !== "" && drawing.viewport !== null && legendFits(legendHtml, legendFreeHeightMm(drawing.viewport));

  const subtitle = buildSheetSubtitle(content);
  const pills = [
    TIPO_LABELS[exercise.tipo] ?? exercise.tipo,
    exercise.subtipo ? (SUBTIPO_LABELS[exercise.subtipo] ?? exercise.subtipo) : "",
    typeof exercise.durationMinutes === "number" ? `${exercise.durationMinutes} min` : "",
  ]
    .filter(Boolean)
    .map((pill) => `<span class="ficha-pill">${escapeHtml(pill)}</span>`)
    .join("");

  return `<section class="ficha">
    <header class="ficha-header">
      <div class="ficha-heading">
        <h1 class="ficha-title">${escapeHtml(exercise.name)}</h1>
        ${subtitle ? `<div class="ficha-subtitle">${escapeHtml(subtitle)}</div>` : ""}
      </div>
      <div class="ficha-pills">${pills}</div>
    </header>
    <div class="ficha-body">
      <div class="ficha-left">${drawing.html}${showLegend ? legendHtml : ""}</div>
      ${buildSheetPanelHtml(content)}
    </div>
    <footer class="ficha-footer">${escapeHtml(footer)}</footer>
  </section>`;
}

/** Wraps one or more sheets in a printable document: landscape A4 with the page margin the sheet
 * geometry assumes. On screen the sheets show as white pages on a grey background. */
export function buildPrintDocument(title: string, sheetsHtml: string): string {
  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: A4 landscape; margin: ${SHEET_GEOMETRY.pageMargin}mm; }
        body { margin: 0; background: #fff; }
        @media screen {
          body { background: #e4e8ee; padding: 8mm 0; }
          .ficha { background: #fff; margin: 0 auto 8mm; padding: 0; box-shadow: 0 1px 6px rgba(16, 33, 51, 0.25); }
        }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        ${SHEET_CSS}
        ${BOARD_PRINT_CSS}
      </style>
    </head>
    <body>
      ${sheetsHtml}
    </body>
  </html>`;
}

/** Builds the print document for one exercise: a single landscape A4 sheet (see
 * `buildExerciseSheetHtml`). The caller opens it in a new window and calls `print()`, following the
 * browser-native print approach, with no jsPDF/html2canvas. */
export function buildExercisePrintHtml(exercise: Exercise, options: SheetOptions = {}): string {
  return buildPrintDocument(`${exercise.name} - Ficha`, buildExerciseSheetHtml(exercise, options));
}
