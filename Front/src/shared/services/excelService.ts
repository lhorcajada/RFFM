import * as XLSX from "xlsx";
import type { Player } from "../../apps/federation/pages/Squad/playersTypes";
import type { TeamParticipationSummaryItem } from "../../apps/federation/types/participation";

export function exportSquadToExcel(
  players: Player[],
  teamName: string,
  ageSummary?: Record<number, number>,
  participations?: TeamParticipationSummaryItem[],
  positions?: Record<string, string[]>,
): void {
  const wb = XLSX.utils.book_new();

  // ── Hoja 1: Plantilla con estadísticas ──────────────────────────────────
  const playerRows = players.map((p) => {
    const matches = (p.matches as any) || {};
    const cards = (p.cards as any) || {};

    // Try positions from actas first, then fall back to raw data
    const pid = String(p.playerId ?? "").trim();
    const actaPositions = pid && positions?.[pid];
    const position = actaPositions
      ? actaPositions.join(" / ")
      : ((p.raw as any)?.position ?? (p.raw as any)?.posicion ?? "");

    return {
      "Nº": p.jerseyNumber ?? "",
      Nombre: p.name ?? "",
      "ID Licencia": p.playerId ?? "",
      Edad: p.age ?? "",
      Posición: position,
      Partidos: matches.played ?? 0,
      Goles: matches.totalGoals ?? 0,
      Titular: matches.starter ?? 0,
      Suplente: matches.substitute ?? 0,
      Amarillas: cards.yellow ?? cards.amarillas ?? 0,
      Rojas: cards.red ?? cards.rojas ?? 0,
      "Doble Amarilla": cards.doubleYellow ?? cards.doble_amarilla ?? 0,
    };
  });

  const wsPlayers = XLSX.utils.json_to_sheet(playerRows);
  wsPlayers["!cols"] = [
    { wch: 6 },
    { wch: 35 },
    { wch: 14 },
    { wch: 7 },
    { wch: 14 },
    { wch: 9 },
    { wch: 7 },
    { wch: 9 },
    { wch: 9 },
    { wch: 10 },
    { wch: 7 },
    { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPlayers, "Plantilla");

  // ── Hoja 2: Resumen de edades ────────────────────────────────────────────
  if (ageSummary && Object.keys(ageSummary).length > 0) {
    const ageRows = Object.keys(ageSummary)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => ({ Edad: Number(k), Cantidad: ageSummary[Number(k)] }));

    const wsAges = XLSX.utils.json_to_sheet(ageRows);
    wsAges["!cols"] = [{ wch: 8 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsAges, "Edades");
  }

  // ── Hoja 3: Participaciones ──────────────────────────────────────────────
  if (participations && participations.length > 0) {
    const partRows = participations.map((p) => ({
      Competición: p.competitionName ?? "",
      Grupo: p.groupName ?? "",
      Equipo: p.teamName ?? "",
      Código: p.teamCode ?? "",
      Puntos: p.teamPoints ?? "",
      Jugadores: p.count ?? "",
    }));

    const wsParts = XLSX.utils.json_to_sheet(partRows);
    wsParts["!cols"] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 30 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
    ];
    XLSX.utils.book_append_sheet(wb, wsParts, "Participaciones");
  }

  const fileName = `${teamName || "plantilla"}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
