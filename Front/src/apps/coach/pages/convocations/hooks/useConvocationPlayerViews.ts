import { useMemo } from "react";
import type { PlayerResponse } from "../../../services/teamplayerService";
import type { PlayerRating } from "../../../types/playerRating";
import type { GridCell, MatchColumn } from "../components/convocationMatchDetail.types";
import type { SquadPlayer } from "../../squad/components/IdealLineup";

type ConvocationPlayersInput = {
  players: PlayerResponse[];
  mgmtNotCalled: string[];
  mgmtPending: string[];
  mgmtPhotos: Record<string, string | null>;
  mgmtRatings: Record<string, PlayerRating>;
  matchColumns: MatchColumn[];
  enrichedGrid: Map<string, Map<string, GridCell>>;
};

export type ConvocationPlayerViews = {
  playerStreaks: Map<string, number>;
  playerTechnicalTotals: Map<string, number>;
  lineupPlayers: SquadPlayer[];
  notCalledPlayers: SquadPlayer[];
  pendingPlayers: SquadPlayer[];
};

function buildDisplayName(player: PlayerResponse): string {
  return player.alias || `${player.name ?? ""} ${player.lastName ?? ""}`.trim() || "Jugador";
}

export function useConvocationPlayerViews(input: ConvocationPlayersInput): ConvocationPlayerViews {
  const { players, mgmtNotCalled, mgmtPending, mgmtPhotos, mgmtRatings, matchColumns, enrichedGrid } = input;

  const playerStreaks = useMemo(() => {
    const result = new Map<string, number>();
    const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
    for (const player of players) {
      let streak = 0;
      for (const col of matchColumns) {
        const cell = enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && NOT_CALLED_NAMES.has(cell.statusName)) {
          const isTechDecision = !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
          if (isTechDecision) break;
        }
        streak++;
      }
      result.set(player.id, streak);
    }
    return result;
  }, [players, matchColumns, enrichedGrid]);

  const playerTechnicalTotals = useMemo(() => {
    const NOT_CALLED_NAMES = new Set(["Deconvoke", "No disponible"]);
    const result = new Map<string, number>();
    for (const player of players) {
      let total = 0;
      for (const col of matchColumns) {
        const cell = enrichedGrid.get(col.eventId)?.get(player.id);
        if (cell && NOT_CALLED_NAMES.has(cell.statusName) && cell.statusName !== "No disponible") {
          const isTech = !cell.excuseTypeId || !!cell.excuseName?.toLowerCase().includes("decisi");
          if (isTech) total++;
        }
      }
      result.set(player.id, total);
    }
    return result;
  }, [players, matchColumns, enrichedGrid]);

  const lineupPlayers = useMemo(() => {
    const notCalledSet = new Set(mgmtNotCalled);
    const pendingSet = new Set(mgmtPending);
    return players
      .filter((p) => p.isInjured !== true && !notCalledSet.has(p.id) && !pendingSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: buildDisplayName(p),
        alias: p.alias ?? null,
        photoSrc: mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [players, mgmtNotCalled, mgmtPending, mgmtPhotos, mgmtRatings, playerStreaks, playerTechnicalTotals]);

  const notCalledPlayers = useMemo(() => {
    const notCalledSet = new Set(mgmtNotCalled);
    return players
      .filter((p) => notCalledSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: buildDisplayName(p),
        alias: p.alias ?? null,
        photoSrc: mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: p.isInjured ?? false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [players, mgmtNotCalled, mgmtPhotos, mgmtRatings, playerStreaks, playerTechnicalTotals]);

  const pendingPlayers = useMemo(() => {
    const pendingSet = new Set(mgmtPending);
    return players
      .filter((p) => pendingSet.has(p.id))
      .map((p) => ({
        id: p.id,
        displayName: buildDisplayName(p),
        alias: p.alias ?? null,
        photoSrc: mgmtPhotos[p.id] ?? null,
        dorsal: p.dorsal ?? null,
        position: p.position ?? null,
        competitiveness: mgmtRatings[p.id]?.competitiveness ?? null,
        isInjured: false,
        streakCount: playerStreaks.get(p.id) ?? null,
        technicalTotal: playerTechnicalTotals.get(p.id) ?? null,
      }));
  }, [players, mgmtPending, mgmtPhotos, mgmtRatings, playerStreaks, playerTechnicalTotals]);

  return {
    playerStreaks,
    playerTechnicalTotals,
    lineupPlayers,
    notCalledPlayers,
    pendingPlayers,
  };
}