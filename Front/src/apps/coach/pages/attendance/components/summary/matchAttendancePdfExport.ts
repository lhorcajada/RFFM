import jsPDF from "jspdf";
import type { MatchAttendanceCellState, MatchAttendanceColumn, PlayerMatchSummary } from "./types";

// Same cap the collapsed card's form strip uses on screen — "Exportar resumen"
// mirrors exactly what the collapsed card shows, so it keeps the same limit.
const FORM_STRIP_MAX_MATCHES = 5;

const MH = 25; // horizontal margin (pts)
const MV = 25; // vertical margin (pts)

function isGoalkeeperPosition(position?: string | null): boolean {
  const p = (position ?? "").toLowerCase();
  return p.includes("portero") || p.includes("keeper") || p.includes("arquero");
}

function stateLabel(state: MatchAttendanceCellState): string {
  switch (state) {
    case "starter": return "Titular";
    case "called": return "Convocado";
    case "notCalled": return "Desconvocado";
    default: return "No convocado";
  }
}

function stateAbbrev(state: MatchAttendanceCellState): string {
  switch (state) {
    case "starter": return "T";
    case "called": return "C";
    case "notCalled": return "D";
    default: return "-";
  }
}

function stateRgb(state: MatchAttendanceCellState): [number, number, number] {
  switch (state) {
    case "starter": return [46, 125, 50];
    case "called": return [21, 101, 192];
    case "notCalled": return [230, 81, 0];
    default: return [150, 150, 150];
  }
}

function findCell(row: PlayerMatchSummary, column: MatchAttendanceColumn) {
  const cell = row.cells.find((item) => item.eventId === column.eventId);
  return {
    state: (cell?.state ?? "absent") as MatchAttendanceCellState,
    minutesPlayed: cell?.minutesPlayed ?? null,
  };
}

function formatDate(value: string | null): string {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function todayStr(): string {
  return new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function safeFilename(name: string): string {
  return name.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
}

// ─── Page header ───────────────────────────────────────────────────────────

function drawPageHeader(doc: jsPDF, title: string, teamName?: string | null): number {
  const W = doc.internal.pageSize.getWidth();
  const CW = W - 2 * MH;
  const y = MV;

  doc.setFillColor(30, 30, 30);
  doc.rect(MH, y, CW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title, MH + 6, y + 14.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(170, 170, 170);
  const subtitle = teamName ? `${teamName}  ·  ${todayStr()}` : todayStr();
  doc.text(subtitle, W - MH - 4, y + 14.5, { align: "right" });

  return y + 22 + 8;
}

// ─── Dorsal badge ──────────────────────────────────────────────────────────

function drawDorsalBadge(
  doc: jsPDF,
  row: PlayerMatchSummary,
  x: number,
  y: number,
): number {
  if (row.dorsal == null) return x;
  const [r, g, b] = isGoalkeeperPosition(row.position) ? [198, 40, 40] : [21, 101, 192];
  const w = 16;
  const h = 12;
  doc.setFillColor(r, g, b);
  doc.rect(x, y, w, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(String(row.dorsal), x + w / 2, y + h - 3.5, { align: "center" });
  return x + w + 5;
}

// ─── Player header row (identity + aggregate chips) ───────────────────────

const PLAYER_HEADER_H = 18;

function drawPlayerHeaderRow(doc: jsPDF, row: PlayerMatchSummary, y: number, width: number): number {
  doc.setFillColor(242, 242, 242);
  doc.rect(MH, y, width, PLAYER_HEADER_H, "F");

  let x = MH + 3;
  x = drawDorsalBadge(doc, row, x, y + 3);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 30, 30);
  doc.text(row.playerName, x, y + PLAYER_HEADER_H - 6.5);

  const summary = `${row.totalMatches} partidos · ${row.startedMatches} tit. · ${row.notCalledMatches} no conv. · ${row.seasonMinutesPlayed ?? 0} min temporada`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(90, 90, 90);
  doc.text(summary, MH + width - 4, y + PLAYER_HEADER_H - 6.5, { align: "right" });

  return y + PLAYER_HEADER_H;
}

// ─── Form strip (last N match states) ─────────────────────────────────────

const FORM_BADGE_W = 16;
const FORM_BADGE_H = 12;

function drawFormStrip(
  doc: jsPDF,
  row: PlayerMatchSummary,
  columns: MatchAttendanceColumn[],
  y: number,
  width: number,
): number {
  const stripColumns = columns.slice(-FORM_STRIP_MAX_MATCHES);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(110, 110, 110);
  doc.text("Forma:", MH + 3, y + FORM_BADGE_H - 4);

  let x = MH + 3 + doc.getTextWidth("Forma:") + 4;
  for (const column of stripColumns) {
    const { state } = findCell(row, column);
    const [r, g, b] = stateRgb(state);
    doc.setFillColor(r, g, b);
    doc.rect(x, y, FORM_BADGE_W, FORM_BADGE_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text(stateAbbrev(state), x + FORM_BADGE_W / 2, y + FORM_BADGE_H - 3.5, { align: "center" });
    x += FORM_BADGE_W + 3;
  }

  return y + FORM_BADGE_H + 6;
}

// ─── Match detail row (full export) ───────────────────────────────────────

const DETAIL_ROW_H = 14;

function drawMatchDetailRow(
  doc: jsPDF,
  row: PlayerMatchSummary,
  column: MatchAttendanceColumn,
  y: number,
  width: number,
  rowIndex: number,
): number {
  const { state, minutesPlayed } = findCell(row, column);
  const bg = rowIndex % 2 === 0 ? 251 : 255;
  doc.setFillColor(bg, bg, bg);
  doc.rect(MH, y, width, DETAIL_ROW_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(40, 40, 40);
  let label = column.label;
  if (column.rival) label += ` · ${column.rival}`;
  doc.text(label, MH + 4, y + DETAIL_ROW_H - 4);

  let rightX = MH + width - 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  if (minutesPlayed != null) {
    const minutesText = `${minutesPlayed}'`;
    doc.setTextColor(60, 60, 60);
    doc.text(minutesText, rightX, y + DETAIL_ROW_H - 4, { align: "right" });
    rightX -= doc.getTextWidth(minutesText) + 8;
  }

  const [sr, sg, sb] = stateRgb(state);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(sr, sg, sb);
  const stateText = stateLabel(state);
  doc.text(stateText, rightX, y + DETAIL_ROW_H - 4, { align: "right" });
  rightX -= doc.getTextWidth(stateText) + 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(120, 120, 120);
  doc.text(formatDate(column.date), rightX, y + DETAIL_ROW_H - 4, { align: "right" });
  rightX -= doc.getTextWidth(formatDate(column.date)) + 8;

  if (column.isFriendly) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(198, 100, 0);
    doc.text("Amistoso", rightX, y + DETAIL_ROW_H - 4, { align: "right" });
  }

  return y + DETAIL_ROW_H;
}

// ─── Page-break helper ─────────────────────────────────────────────────────

function ensureSpace(doc: jsPDF, y: number, neededHeight: number, title: string, teamName?: string | null): number {
  const PAGE_H = doc.internal.pageSize.getHeight();
  const bottomLimit = PAGE_H - MV - 6;
  if (y + neededHeight > bottomLimit) {
    doc.addPage();
    return drawPageHeader(doc, title, teamName);
  }
  return y;
}

function addPageNumbers(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(165, 165, 165);
    doc.text(`${p} / ${total}`, W / 2, H - 10, { align: "center" });
  }
}

// ─── Public export functions ───────────────────────────────────────────────

export async function exportMatchesSummaryPdf(
  rows: PlayerMatchSummary[],
  columns: MatchAttendanceColumn[],
  teamName?: string | null,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const width = W - 2 * MH;
  const title = "Resumen de partidos";

  let y = drawPageHeader(doc, title, teamName);

  for (const row of rows) {
    const blockHeight = PLAYER_HEADER_H + FORM_BADGE_H + 6 + 6;
    y = ensureSpace(doc, y, blockHeight, title, teamName);
    y = drawPlayerHeaderRow(doc, row, y, width);
    y = drawFormStrip(doc, row, columns, y, width);
    y += 6;
  }

  addPageNumbers(doc);
  const datePart = todayStr().replace(/\//g, "-");
  const namePart = teamName ? safeFilename(teamName) : "equipo";
  doc.save(`resumen_partidos_${namePart}_${datePart}.pdf`);
}

export async function exportMatchesFullPdf(
  rows: PlayerMatchSummary[],
  columns: MatchAttendanceColumn[],
  teamName?: string | null,
): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const width = W - 2 * MH;
  const title = "Partidos — informe completo";

  let y = drawPageHeader(doc, title, teamName);

  for (const row of rows) {
    const headerHeight = PLAYER_HEADER_H;
    y = ensureSpace(doc, y, headerHeight + DETAIL_ROW_H, title, teamName);
    y = drawPlayerHeaderRow(doc, row, y, width);

    let rowIndex = 0;
    for (const column of columns) {
      y = ensureSpace(doc, y, DETAIL_ROW_H, title, teamName);
      y = drawMatchDetailRow(doc, row, column, y, width, rowIndex);
      rowIndex++;
    }

    y += 8;
  }

  addPageNumbers(doc);
  const datePart = todayStr().replace(/\//g, "-");
  const namePart = teamName ? safeFilename(teamName) : "equipo";
  doc.save(`partidos_completo_${namePart}_${datePart}.pdf`);
}
