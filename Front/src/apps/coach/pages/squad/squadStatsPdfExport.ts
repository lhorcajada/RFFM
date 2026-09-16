import jsPDF from "jspdf";
import type { PlayerStatistics } from "../../services/teamPlayerStatisticsService";
import { SEASON_MINUTES_TARGET_PERCENT } from "../../services/teamPlayerStatisticsService";
import { calledButAbsentLabel, injuryLabel, minutesTargetCaption } from "./playerStatsText";
import { computeEf } from "../../utils/playerFormMetrics";

const MH = 20; // horizontal page margin (pts)
const MV = 20; // vertical page margin (pts)
const COLUMNS = 2;
const COLUMN_GAP = 12;
const CARD_PADDING = 8;
const LINE_H = 11;
const CARD_GAP = 8;

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

function pct(value: number | null): string {
  return value == null ? "—" : `${Math.round(value)}%`;
}

type CardLine = { text: string; bold?: boolean; size?: number; color?: [number, number, number] };

function buildCardLines(player: PlayerStatistics): CardLine[] {
  const ef = computeEf(player.readiness, player.fatigue);
  const lines: CardLine[] = [];

  const header = `${player.dorsal ?? "—"}  ${player.displayName}${player.position ? ` · ${player.position}` : ""}`;
  lines.push({ text: header, bold: true, size: 9 });

  lines.push({
    text: `EF ${pct(ef)}   Rodaje ${pct(player.readiness)}   Cansancio ${pct(player.fatigue)}   Forma física ${pct(player.physicalFitness)}`,
    size: 7.5,
  });

  lines.push({
    text: `Goles ${player.goals}   Amar. ${player.yellowCards}   Rojas ${player.redCards}   Min. ${player.minutesPlayed}   Ausencias ${player.matchesAbsentAttributableToPlayer}`,
    size: 7.5,
  });

  lines.push({
    text: `Entrenamientos ${player.trainings.attended} de ${player.trainings.possible}`,
    size: 7.5,
  });

  const friendliesNote = calledButAbsentLabel(player.friendlies.calledButAbsent);
  lines.push({
    text: `Amistosos ${player.friendlies.attended} de ${player.friendlies.possible}${friendliesNote ? ` — ${friendliesNote}` : ""}`,
    size: 7.5,
    color: friendliesNote ? [178, 58, 58] : undefined,
  });

  const leagueNote = calledButAbsentLabel(player.league.calledButAbsent);
  lines.push({
    text: `Liga ${player.league.attended} de ${player.league.possible}${leagueNote ? ` — ${leagueNote}` : ""}`,
    size: 7.5,
    color: leagueNote ? [178, 58, 58] : undefined,
  });

  if (player.minutesPlayedPercentOfSeasonTotal != null) {
    lines.push({
      text: `Minutos temporada: ${pct(player.minutesPlayedPercentOfSeasonTotal)} (objetivo mínimo ${SEASON_MINUTES_TARGET_PERCENT}%)`,
      size: 7.5,
      bold: true,
    });
    lines.push({ text: minutesTargetCaption(player), size: 6.8, color: [110, 110, 110] });
  }

  const injury = injuryLabel(player);
  if (injury) {
    lines.push({ text: injury, size: 7, color: [178, 58, 58] });
  }

  return lines;
}

function cardHeight(lines: CardLine[]): number {
  return CARD_PADDING * 2 + lines.length * LINE_H;
}

function drawCard(doc: jsPDF, player: PlayerStatistics, x: number, y: number, w: number, h: number, rowIdx: number): void {
  doc.setFillColor(rowIdx % 2 === 0 ? 250 : 255, rowIdx % 2 === 0 ? 250 : 255, rowIdx % 2 === 0 ? 251 : 255);
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");

  const lines = buildCardLines(player);
  let ty = y + CARD_PADDING + 6;
  const tx = x + CARD_PADDING;
  const maxWidth = w - CARD_PADDING * 2;

  for (const line of lines) {
    doc.setFont("helvetica", line.bold ? "bold" : "normal");
    doc.setFontSize(line.size ?? 7.5);
    doc.setTextColor(...(line.color ?? [40, 40, 40]));
    const wrapped = doc.splitTextToSize(line.text, maxWidth) as string[];
    for (const wrappedLine of wrapped) {
      doc.text(wrappedLine, tx, ty);
      ty += LINE_H;
    }
  }
}

/**
 * Exports a card-grid PDF (one block per player, mirroring the on-screen SquadStatistics
 * cards) — EF/Rodaje/Cansancio, Forma física, goles/tarjetas/minutos, ausencias imputables,
 * ratios de Entrenamientos/Amistosos/Liga con su nota de "convocado no asistió", el objetivo
 * de minutos de temporada (solo F11) y la línea de lesión — en vez de una tabla de una fila
 * por jugador, ya que esa información ya no cabe en una sola fila.
 */
export function exportSquadStatisticsPdf(players: PlayerStatistics[], teamName?: string): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const CW = W - 2 * MH;
  const BOTTOM_LIMIT = PAGE_H - MV;
  const cardW = (CW - COLUMN_GAP * (COLUMNS - 1)) / COLUMNS;

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
  y += 18;

  let rowIdx = 0;
  for (let i = 0; i < players.length; i += COLUMNS) {
    const rowPlayers = players.slice(i, i + COLUMNS);
    const rowH = Math.max(...rowPlayers.map((p) => cardHeight(buildCardLines(p))));

    if (y + rowH > BOTTOM_LIMIT) {
      doc.addPage();
      y = MV;
    }

    rowPlayers.forEach((player, colIdx) => {
      const x = MH + colIdx * (cardW + COLUMN_GAP);
      drawCard(doc, player, x, y, cardW, rowH, rowIdx);
    });

    y += rowH + CARD_GAP;
    rowIdx++;
  }

  const datePart = todayStr().replace(/\//g, "-");
  const namePart = teamName ? safeFilename(teamName) : "plantilla";
  doc.save(`estadisticas_${namePart}_${datePart}.pdf`);
}
