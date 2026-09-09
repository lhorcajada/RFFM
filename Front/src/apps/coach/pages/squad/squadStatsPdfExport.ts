import jsPDF from "jspdf";
import type { PlayerStatistics } from "../../services/teamPlayerStatisticsService";

const MH = 25; // horizontal margin (pts)
const MV = 25; // vertical margin (pts)
const HEADER_H = 15;
const ROW_H = 12;

function todayStr(): string {
  return new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_\-]/gi, "_")
    .toLowerCase();
}

function formStatusLabel(value: number | null): string {
  return value == null ? "Sin datos" : `${value}%`;
}

function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && doc.getTextWidth(cut + "…") > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut + "…";
}

/**
 * Exports a plain table PDF (Dorsal, Jugador, Posición, Goles, Amarillas, Rojas,
 * Minutos, Estado de forma) with one row per player, paginating when the table
 * overflows the page. Pagination logic mirrors squadPdfExport.ts's
 * drawSummaryPage BOTTOM_LIMIT check.
 */
export function exportSquadStatisticsPdf(players: PlayerStatistics[], teamName?: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CW = W - 2 * MH;
  const BOTTOM_LIMIT = PAGE_H - MV - 8;
  let y = MV;

  doc.setFillColor(30, 30, 30);
  doc.rect(MH, y, CW, 22, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("ESTADÍSTICAS DE LA PLANTILLA", W / 2, y + 14.5, { align: "center" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  const subtitle = teamName ? `${teamName}  ·  ${todayStr()}` : todayStr();
  doc.text(subtitle, W / 2, y + 8, { align: "center" });
  y += 16;

  const cols = [
    { label: "D.", w: 30, align: "center" as const, key: "dorsal" as const },
    { label: "Jugador", w: 150, align: "left" as const, key: "displayName" as const },
    { label: "Posición", w: 90, align: "left" as const, key: "position" as const },
    { label: "Goles", w: 47, align: "center" as const, key: "goals" as const },
    { label: "Amar.", w: 47, align: "center" as const, key: "yellowCards" as const },
    { label: "Rojas", w: 47, align: "center" as const, key: "redCards" as const },
    { label: "Minutos", w: 62, align: "center" as const, key: "minutesPlayed" as const },
    { label: "Estado de forma", w: 72.28, align: "center" as const, key: "formStatus" as const },
  ];

  function drawTableHeader(yy: number): void {
    doc.setFillColor(45, 45, 45);
    doc.rect(MH, yy, CW, HEADER_H, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    let cx = MH;
    for (const col of cols) {
      const tx = col.align === "center" ? cx + col.w / 2 : cx + 4;
      doc.text(col.label, tx, yy + HEADER_H - 4, { align: col.align });
      cx += col.w;
    }
  }

  drawTableHeader(y);
  y += HEADER_H;

  players.forEach((p, rowIdx) => {
    if (y + ROW_H > BOTTOM_LIMIT) {
      doc.addPage();
      y = MV;
      drawTableHeader(y);
      y += HEADER_H;
    }

    doc.setFillColor(rowIdx % 2 === 0 ? 251 : 255, rowIdx % 2 === 0 ? 251 : 255, rowIdx % 2 === 0 ? 251 : 255);
    doc.rect(MH, y, CW, ROW_H, "F");

    const rowVals: string[] = [
      p.dorsal != null ? String(p.dorsal) : "—",
      p.displayName,
      p.position ?? "—",
      String(p.goals),
      String(p.yellowCards),
      String(p.redCards),
      String(p.minutesPlayed),
      formStatusLabel(p.formStatus),
    ];

    let cx = MH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(40, 40, 40);
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const display = truncate(doc, rowVals[i], col.w - 6);
      const tx = col.align === "center" ? cx + col.w / 2 : cx + 4;
      doc.text(display, tx, y + ROW_H - 3, { align: col.align });
      cx += col.w;
    }

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(MH, y + ROW_H, MH + CW, y + ROW_H);

    y += ROW_H;
  });

  const datePart = todayStr().replace(/\//g, "-");
  const namePart = teamName ? safeFilename(teamName) : "plantilla";
  doc.save(`estadisticas_${namePart}_${datePart}.pdf`);
}
