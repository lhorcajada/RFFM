import jsPDF from "jspdf";
import { playerInfoLines, type SquadMatchStatsRow } from "./squadMatchStatsModel";

const MARGIN = 14;
const ROW_H = 9;
const HEADER_FONT = 7.5;
const BODY_FONT = 8.5;

type Column = { label: string; width: number; value: (r: SquadMatchStatsRow) => string };

const COLUMNS: Column[] = [
  { label: "Jugador", width: 104, value: (r) => playerInfoLines(r).title },
  { label: "Conv.", width: 12, value: (r) => String(r.league.callUps) },
  { label: "Tit.", width: 11, value: (r) => String(r.league.starts) },
  { label: "Gol", width: 11, value: (r) => String(r.league.goals) },
  { label: "Am.", width: 11, value: (r) => String(r.league.yellowCards) },
  { label: "Roj.", width: 11, value: (r) => String(r.league.redCards) },
  { label: "Min.", width: 13, value: (r) => String(r.league.minutesPlayed) },
  { label: "Gol", width: 11, value: (r) => String(r.other.goals) },
  { label: "Am.", width: 11, value: (r) => String(r.other.yellowCards) },
  { label: "Roj.", width: 11, value: (r) => String(r.other.redCards) },
  { label: "Min.", width: 13, value: (r) => String(r.other.minutesPlayed) },
];

const LEAGUE_FROM = 1;
const OTHER_FROM = 7;

function todayStr(): string {
  return new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]/gi, "_")
    .toLowerCase();
}

export function squadMatchStatsFileName(teamName?: string): string {
  const namePart = teamName ? safeFilename(teamName) : "plantilla";
  return `plantilla_estadisticas_${namePart}_${todayStr().replace(/\//g, "-")}.pdf`;
}

export function exportSquadMatchStatsPdf(rows: SquadMatchStatsRow[], teamName?: string): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const xs: number[] = [];
  COLUMNS.reduce((x, c) => {
    xs.push(x);
    return x + c.width;
  }, MARGIN);
  const tableW = COLUMNS.reduce((sum, c) => sum + c.width, 0);

  let y = MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Estadísticas de la plantilla", pageW / 2, y + 4, { align: "center" });
  y += 9;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(teamName ? `${teamName}  ·  ${todayStr()}` : todayStr(), pageW / 2, y, { align: "center" });
  y += 6;

  const drawHeader = () => {
    const leagueX = xs[LEAGUE_FROM];
    const otherX = xs[OTHER_FROM];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(HEADER_FONT);
    doc.text("LIGA", leagueX + (otherX - leagueX) / 2, y, { align: "center" });
    doc.text("AMISTOSOS Y TORNEOS", otherX + (MARGIN + tableW - otherX) / 2, y, { align: "center" });
    y += 4;
    COLUMNS.forEach((c, i) => doc.text(c.label, i === 0 ? xs[i] : xs[i] + c.width - 2, y, { align: i === 0 ? "left" : "right" }));
    y += 1.5;
    doc.setDrawColor(120);
    doc.line(MARGIN, y, MARGIN + tableW, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(BODY_FONT);
  };

  drawHeader();
  rows.forEach((row, idx) => {
    if (y + ROW_H > pageH - MARGIN) {
      doc.addPage();
      y = MARGIN;
      drawHeader();
    }
    if (idx % 2 === 0) {
      doc.setFillColor(244, 244, 246);
      doc.rect(MARGIN, y - 4, tableW, ROW_H, "F");
    }
    COLUMNS.forEach((c, i) =>
      doc.text(c.value(row), i === 0 ? xs[i] + 1 : xs[i] + c.width - 2, y, { align: i === 0 ? "left" : "right" }),
    );
    const { detail } = playerInfoLines(row);
    if (detail) {
      doc.setFontSize(7);
      doc.setTextColor(90);
      doc.text(detail, xs[0] + 1, y + 3.6);
      doc.setTextColor(0);
      doc.setFontSize(BODY_FONT);
    }
    y += ROW_H;
  });

  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(
    "Conv. = convocatorias · Tit. = titular · Am. = amarillas · Roj. = rojas · Min. = minutos. Amistosos y torneos = total de la temporada menos liga.",
    MARGIN,
    pageH - 8,
    { maxWidth: pageW - MARGIN * 2 },
  );

  doc.save(squadMatchStatsFileName(teamName));
}
