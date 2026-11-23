import { renderToStaticMarkup } from "react-dom/server";
import type { Exercise, ExerciseLevelRow, ExerciseTeam } from "../../types/training";
import {
  TacticalBoardSnapshotPreviewStatic,
  hasBoardObjects,
  tryParseBoardSnapshot,
  type PlayersById,
} from "../../components/TacticalBoardSnapshotPreview";
import boardStyles from "../../components/TacticalBoardSnapshotPreview.module.css";
import boardPreviewCss from "../../components/TacticalBoardSnapshotPreview.module.css?inline";
import { MATERIAL_OPTIONS } from "./new/constants";
import { detectBoardViewport, type BoardViewport } from "./new/helpers/boardViewport";
import { escapeHtml, mediaUrl } from "./printHtml";

/** Geometry of the landscape A4 sheet, in millimetres. The page margin is 8 mm, so the sheet is
 * 281 x 193 mm (one millimetre short of the 194 mm printable height, so rounding never pushes a
 * sheet onto a second page): header, body and footer stacked, the body split into the drawing
 * column on the left and the fixed side panel on the right. */
export const SHEET_GEOMETRY = {
  pageMargin: 8,
  width: 281,
  height: 193,
  headerHeight: 15,
  footerHeight: 5,
  rowGap: 3,
  panelWidth: 102,
  columnGap: 5,
  /** Highest the drawing may be, so a half pitch leaves room for the material legend. */
  drawingMaxHeight: 140,
  legendGap: 2,
  pitchWidthMeters: 105,
  pitchHeightMeters: 68,
} as const;

const BODY_HEIGHT =
  SHEET_GEOMETRY.height - SHEET_GEOMETRY.headerHeight - SHEET_GEOMETRY.footerHeight - SHEET_GEOMETRY.rowGap * 2;
const LEFT_WIDTH = SHEET_GEOMETRY.width - SHEET_GEOMETRY.panelWidth - SHEET_GEOMETRY.columnGap;

export const SHEET_BODY_HEIGHT_MM = BODY_HEIGHT;
export const SHEET_LEFT_WIDTH_MM = LEFT_WIDTH;

type Box = { width: number; height: number };

/** Size of the box that holds the pitch for a viewport: the full pitch (105 x 68) fills the column
 * width, a half pitch (52.5 x 68, `left` or `right`) is as tall as the drawing may be. The
 * pitch is fitted inside the fixed drawing area with its own aspect ratio ("contain"). */
export function pitchBoxMm(viewport: BoardViewport): Box {
  const { pitchWidthMeters, pitchHeightMeters, drawingMaxHeight } = SHEET_GEOMETRY;
  const ratio = viewport === "full" ? pitchWidthMeters / pitchHeightMeters : pitchWidthMeters / 2 / pitchHeightMeters;
  const heightForFullWidth = LEFT_WIDTH / ratio;
  const height = Math.min(drawingMaxHeight, heightForFullWidth);
  return { width: height * ratio, height };
}

/** Height still free in the drawing column under the pitch, where the material legend goes. */
export function legendFreeHeightMm(viewport: BoardViewport): number {
  return BODY_HEIGHT - pitchBoxMm(viewport).height - SHEET_GEOMETRY.legendGap;
}

/** Everything the side panel and the subtitle of a sheet print. Exercises and the exercise form
 * both map onto it, so the sheet and the fit check read the same shape. */
export type SheetContent = {
  espacio: string | null;
  turnoMinutos: number | null;
  nivelDibujo: number | null;
  jugadores: ExerciseTeam[];
  secuencia: string[];
  reglas: string[];
  queSeVe: string[];
  nivelesColumnas: string[];
  niveles: ExerciseLevelRow[];
  /** One label per game-model relation, shown as a compact line at the end of the panel. */
  modeloDeJuego: string[];
};

type SheetSource = {
  espacio?: string | null;
  turnoMinutos?: number | null;
  nivelDibujo?: number | null;
  jugadores?: ExerciseTeam[];
  secuencia?: string[];
  reglas?: string[];
  queSeVe?: string[];
  nivelesColumnas?: string[];
  niveles?: ExerciseLevelRow[];
};

function contentFrom(source: SheetSource, modeloDeJuego: string[]): SheetContent {
  return {
    espacio: source.espacio ?? null,
    turnoMinutos: source.turnoMinutos ?? null,
    nivelDibujo: source.nivelDibujo ?? null,
    jugadores: source.jugadores ?? [],
    secuencia: source.secuencia ?? [],
    reglas: source.reglas ?? [],
    queSeVe: source.queSeVe ?? [],
    nivelesColumnas: source.nivelesColumnas ?? [],
    niveles: source.niveles ?? [],
    modeloDeJuego,
  };
}

export function sheetContentFromExercise(exercise: Exercise): SheetContent {
  const labels = (exercise.modelRelations ?? []).flatMap((relation) => [
    `${relation.subprincipioNumero ?? ""} · ${relation.subprincipioTitulo ?? ""}`,
    ...relation.items.map((item) => `${item.subSubPrincipioNumero ?? ""} · ${item.subSubPrincipioRol ?? ""}`),
  ]);
  return contentFrom(exercise, labels);
}

/** Maps the exercise form onto a sheet. The form only holds ids for the game-model relations, so
 * each one is stood in for by a generic label of similar length. */
export function sheetContentFromForm(
  form: SheetSource & { modelRelations: unknown[] },
): SheetContent {
  return contentFrom(
    form,
    form.modelRelations.map(() => "0.0 · Modelo de juego"),
  );
}

const hasText = (value: string | null | undefined): value is string => (value ?? "").trim() !== "";

const nonEmptyLines = (lines: string[]): string[] => lines.filter(hasText);

/** The level rows that have something to print, in level order. */
export function printableLevels(content: SheetContent): ExerciseLevelRow[] {
  return [...content.niveles]
    .filter((row) => content.nivelesColumnas.some((column) => hasText(row.valores[column])))
    .sort((a, b) => a.nivel - b.nivel);
}

/** Subtitle of the sheet: space, turn duration and the level the drawing shows. A missing
 * segment is left out together with its separator (E4, E6). */
export function buildSheetSubtitle(content: SheetContent): string {
  const parts: string[] = [];
  if (hasText(content.espacio)) parts.push(`Espacio: ${content.espacio.trim()}`);
  if (content.turnoMinutos !== null) parts.push(`Turno: ${content.turnoMinutos} min`);
  const levels = printableLevels(content);
  if (content.nivelDibujo !== null && levels.some((row) => row.nivel === content.nivelDibujo)) {
    parts.push(`Nivel ${content.nivelDibujo}`);
  }
  return parts.join(" · ");
}

const TEAM_SWATCH_CLASS: Record<string, string> = {
  blue: "ficha-swatch--blue",
  yellow: "ficha-swatch--yellow",
  gray: "ficha-swatch--gray",
};

function swatchHtml(team: ExerciseTeam): string {
  const modifier = team.color ? TEAM_SWATCH_CLASS[team.color] : undefined;
  return modifier ? `<span class="ficha-swatch ${modifier}"></span>` : "";
}

function teamHasIdentity(team: ExerciseTeam): boolean {
  return hasText(team.nombre) || team.cantidad !== null || hasText(team.roles) || team.color !== null;
}

function blockHtml(title: string, bodyHtml: string): string {
  return `<section class="ficha-block" data-block="${escapeHtml(title)}"><h3>${escapeHtml(title)}</h3>${bodyHtml}</section>`;
}

function listHtml(lines: string[], ordered: boolean): string {
  const items = nonEmptyLines(lines).map((line) => `<li>${escapeHtml(line.trim())}</li>`).join("");
  return items ? `<${ordered ? "ol" : "ul"} class="ficha-list">${items}</${ordered ? "ol" : "ul"}>` : "";
}

function buildPlayersBlock(content: SheetContent): string {
  const teams = content.jugadores.filter(teamHasIdentity);
  if (teams.length === 0) return "";
  const rows = teams
    .map((team) => {
      const count = team.cantidad !== null ? `${team.cantidad} jug.` : "";
      const label = [hasText(team.nombre) ? `<strong>${escapeHtml(team.nombre.trim())}</strong>` : "", count && escapeHtml(count)]
        .filter(Boolean)
        .join(" · ");
      const roles = hasText(team.roles) ? `<div class="ficha-team-roles">${escapeHtml(team.roles.trim())}</div>` : "";
      return `<div class="ficha-team">${swatchHtml(team)}<div class="ficha-team-text"><div>${label}</div>${roles}</div></div>`;
    })
    .join("");
  return blockHtml("Jugadores", rows);
}

function buildObjectivesBlock(content: SheetContent): string {
  const groups = content.jugadores
    .map((team) => ({ team, lines: nonEmptyLines(team.objetivos) }))
    .filter((group) => group.lines.length > 0)
    .map(({ team, lines }) => {
      const heading =
        hasText(team.nombre) || team.color
          ? `<div class="ficha-team-heading">${swatchHtml(team)}${escapeHtml(team.nombre.trim())}</div>`
          : "";
      return `<div class="ficha-objectives">${heading}${listHtml(lines, false)}</div>`;
    })
    .join("");
  return groups ? blockHtml("Objetivos", groups) : "";
}

function buildLinesBlock(title: string, lines: string[], ordered: boolean): string {
  const list = listHtml(lines, ordered);
  return list ? blockHtml(title, list) : "";
}

function buildLevelsBlock(content: SheetContent): string {
  const levels = printableLevels(content);
  if (levels.length === 0) return "";
  const rows = levels
    .map((row) => {
      const marked = row.nivel === content.nivelDibujo;
      const values = content.nivelesColumnas
        .filter((column) => hasText(row.valores[column]))
        .map((column) => `<span class="ficha-level-value"><strong>${escapeHtml(column)}:</strong> ${escapeHtml(row.valores[column].trim())}</span>`)
        .join("");
      const mark = marked ? `<span class="ficha-level-mark">Dibujo</span>` : "";
      return `<div class="ficha-level${marked ? " ficha-level--marked" : ""}"><span class="ficha-level-number">${row.nivel}</span><div class="ficha-level-values">${values}</div>${mark}</div>`;
    })
    .join("");
  return blockHtml("Niveles", rows);
}

function buildRelationsLine(content: SheetContent): string {
  const labels = content.modeloDeJuego.filter(hasText);
  if (labels.length === 0) return "";
  return `<div class="ficha-relations"><strong>Modelo de juego:</strong> ${escapeHtml(labels.join(" · "))}</div>`;
}

/** The fixed side panel of the sheet: one block per section, left out when it has no content (E1),
 * and the game-model relations as one compact line at the end (E9). The fit check measures this
 * very markup. */
export function buildSheetPanelHtml(content: SheetContent): string {
  const blocks = [
    buildPlayersBlock(content),
    buildObjectivesBlock(content),
    buildLinesBlock("Secuencia", content.secuencia, true),
    buildLinesBlock("Reglas", content.reglas, false),
    buildLinesBlock("Qué se ve sin decir nada", content.queSeVe, false),
    buildLevelsBlock(content),
    buildRelationsLine(content),
  ];
  return `<div class="ficha-panel">${blocks.join("")}</div>`;
}

export type MaterialLegendItem = { label: string; count: number };

/** Counts the material placed on the board, in the order the board editor offers it. */
export function collectMaterialLegend(exercise: Pick<Exercise, "boardStateJson">): MaterialLegendItem[] {
  const snapshot = tryParseBoardSnapshot(exercise.boardStateJson);
  const counts = new Map<string, number>();
  (snapshot?.placedMaterials ?? []).forEach((material) => {
    counts.set(material.kind, (counts.get(material.kind) ?? 0) + 1);
  });
  const known = MATERIAL_OPTIONS.filter((option) => counts.has(option.key)).map((option) => ({
    label: option.label,
    count: counts.get(option.key) ?? 0,
  }));
  const knownKeys = new Set(MATERIAL_OPTIONS.map((option) => option.key));
  const other = [...counts.entries()]
    .filter(([key]) => !knownKeys.has(key as never))
    .map(([key, count]) => ({ label: key, count }));
  return [...known, ...other];
}

export function buildMaterialLegendHtml(items: MaterialLegendItem[]): string {
  const entries = items
    .map((item) => `<span class="ficha-legend-item">${escapeHtml(item.label)} × ${item.count}</span>`)
    .join("");
  return `<div class="ficha-legend"><strong>Material:</strong> ${entries}</div>`;
}

/** Ink-friendly pitch for the printed sheet: white turf and black markings instead of the
 * on-screen green field with white lines, and black outlines on every placed object so
 * white/light ones (zones, posts, lines, texts) stay visible on paper. Space strokes come
 * from inline styles, hence `!important`. */
function buildPrintPitchCss(): string {
  const s = boardStyles;
  return `
.${s.fullPitch}, .${s.halfViewport} { box-shadow: none; }
.${s.pitch}, .${s.mirrorHalf} { background: #fff; }
.${s.terrainBandTop}, .${s.terrainBandBottom}, .${s.terrainGoalBack} { background: #fff; }
.${s.touchLineTop}, .${s.touchLineBottom} { background: #000; }
.${s.midLine}, .${s.goalLine} { background: #000; }
.${s.penaltySpot} { background: #000; }
.${s.centerCircle}, .${s.penaltyArea}, .${s.goalArea}, .${s.penaltyArc}, .${s.goalFrame} { border-color: #000; }
.${s.goalMouth} { border-right-color: #000; }
.${s.spaceStroke} { stroke: #000 !important; }
.${s.chapa} { border-color: #000; }
.${s.chapaAliasOutside} { border-color: #000; }
.${s.materialOnField}, .${s.linesSvg}, .${s.placedText} { filter: drop-shadow(0 0 0.6px #000) drop-shadow(0 0 0.6px #000); }`;
}

export const BOARD_PRINT_CSS = `${boardPreviewCss}${buildPrintPitchCss()}`;

export type SheetDrawing = {
  html: string;
  /** Pitch shown when the drawing is the tactical board; null for an uploaded image or no drawing. */
  viewport: BoardViewport | null;
};

const mm = (value: number) => `${Number(value.toFixed(2))}mm`;

/** The drawing area of the sheet: the uploaded image, or the tactical board cropped to the half
 * pitch it uses (E14), or the "Sin dibujo" notice (E2). */
export function buildSheetDrawing(exercise: Exercise, playersById: PlayersById): SheetDrawing {
  if (exercise.urlImage) {
    return {
      html: `<div class="ficha-drawing ficha-drawing--image"><img src="${escapeHtml(mediaUrl(exercise.urlImage))}" alt="${escapeHtml(exercise.name)}" /></div>`,
      viewport: null,
    };
  }

  const snapshot = tryParseBoardSnapshot(exercise.boardStateJson);
  if (snapshot && hasBoardObjects(snapshot)) {
    const viewport = detectBoardViewport(snapshot);
    const box = pitchBoxMm(viewport);
    const board = renderToStaticMarkup(TacticalBoardSnapshotPreviewStatic({ snapshot, playersById, viewport }));
    return {
      html: `<div class="ficha-drawing ficha-drawing--board ficha-drawing--${viewport === "full" ? "full" : "half"}" style="width:${mm(box.width)};height:${mm(box.height)}">${board}</div>`,
      viewport,
    };
  }

  return { html: `<div class="ficha-drawing ficha-drawing--empty">Sin dibujo</div>`, viewport: null };
}

/** Styles of the sheet. Every class carries the `ficha-` prefix, so the same string can be injected
 * into the app document to measure the panel without touching any other style. */
export const SHEET_CSS = `
.ficha, .ficha *, .ficha-panel, .ficha-panel * { box-sizing: border-box; }
.ficha, .ficha-panel { font-family: Arial, Helvetica, sans-serif; color: #102133; }
.ficha { width: ${SHEET_GEOMETRY.width}mm; height: ${SHEET_GEOMETRY.height}mm; overflow: hidden; display: flex; flex-direction: column; gap: ${SHEET_GEOMETRY.rowGap}mm; break-after: page; page-break-after: always; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ficha:last-child { break-after: auto; page-break-after: auto; }
.ficha-header { flex: 0 0 ${SHEET_GEOMETRY.headerHeight}mm; display: flex; align-items: flex-start; justify-content: space-between; gap: 6mm; border-bottom: 0.4mm solid #102133; padding-bottom: 1mm; overflow: hidden; }
.ficha-heading { min-width: 0; }
.ficha-title { margin: 0; font-size: 17pt; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ficha-subtitle { margin-top: 0.5mm; font-size: 9pt; color: #38506b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ficha-pills { display: flex; flex-wrap: nowrap; gap: 2mm; flex: 0 0 auto; font-size: 8pt; color: #38506b; }
.ficha-pill { border: 0.25mm solid #9fb3c8; border-radius: 4mm; padding: 0.8mm 2.5mm; background: #f6f9fc; white-space: nowrap; }
.ficha-body { flex: 1 1 auto; min-height: 0; display: flex; gap: ${SHEET_GEOMETRY.columnGap}mm; }
.ficha-left { flex: 0 0 ${LEFT_WIDTH}mm; width: ${LEFT_WIDTH}mm; display: flex; flex-direction: column; gap: ${SHEET_GEOMETRY.legendGap}mm; align-items: center; }
.ficha-drawing { border: 0.3mm solid #102133; overflow: hidden; background: #fff; flex: 0 0 auto; }
.ficha-drawing--image, .ficha-drawing--empty { width: ${LEFT_WIDTH}mm; height: ${SHEET_GEOMETRY.drawingMaxHeight}mm; display: flex; align-items: center; justify-content: center; }
.ficha-drawing--empty { border-style: dashed; color: #6b7c8f; font-size: 11pt; }
.ficha-drawing img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.ficha-legend { width: 100%; font-size: 8.5pt; line-height: 1.3; }
.ficha-legend-item { display: inline-block; margin-right: 3mm; white-space: nowrap; }
.ficha-panel { position: relative; flex: 0 0 ${SHEET_GEOMETRY.panelWidth}mm; width: ${SHEET_GEOMETRY.panelWidth}mm; height: ${BODY_HEIGHT}mm; overflow: hidden; font-size: 8.5pt; line-height: 1.3; overflow-wrap: anywhere; }
.ficha-block { margin-bottom: 2.5mm; }
.ficha-block h3 { margin: 0 0 0.8mm; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 0.25mm solid #9fb3c8; padding-bottom: 0.4mm; }
.ficha-list { margin: 0; padding-left: 4.5mm; }
.ficha-list li { margin: 0 0 0.5mm; }
.ficha-team { display: flex; align-items: flex-start; gap: 2mm; margin-bottom: 1mm; }
.ficha-team-text { min-width: 0; }
.ficha-team-roles { color: #38506b; }
.ficha-swatch { display: inline-block; flex: 0 0 3.2mm; width: 3.2mm; height: 3.2mm; margin: 0.4mm 1.5mm 0 0; border-radius: 50%; border: 0.25mm solid #102133; }
.ficha-team .ficha-swatch { margin-right: 0; }
.ficha-swatch--blue { background: #3498db; }
.ficha-swatch--yellow { background: #f1c40f; }
.ficha-swatch--gray { background: #95a5a6; }
.ficha-objectives { margin-bottom: 1mm; }
.ficha-team-heading { display: flex; align-items: center; font-weight: bold; }
.ficha-level { display: flex; align-items: flex-start; gap: 2mm; padding: 0.8mm 1.5mm; margin-bottom: 0.8mm; border: 0.25mm solid #c9d8e6; border-radius: 1.2mm; }
.ficha-level--marked { background: #fde3d0; border-color: #e08a3c; }
.ficha-level-number { flex: 0 0 5mm; font-weight: bold; }
.ficha-level-values { flex: 1 1 auto; min-width: 0; }
.ficha-level-value { display: inline-block; margin-right: 2.5mm; }
.ficha-level-mark { flex: 0 0 auto; font-size: 7pt; font-weight: bold; text-transform: uppercase; }
.ficha-relations { margin-top: 1mm; font-size: 8pt; color: #38506b; }
.ficha-footer { flex: 0 0 ${SHEET_GEOMETRY.footerHeight}mm; font-size: 8pt; color: #38506b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
`;
