import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, type BuildProposalInput } from "../deconvokeProposal";
import type { MatchUnavailability } from "../matchUnavailability";
import type { PlayerResponse } from "../../../../services/teamplayerService";

function player(id: string, activePositionId: number | null): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: activePositionId ? [activePositionId] : [] };
}

// 1 POR, 2 LAT, 3 DFC, 4 MC, 1 MCO, 4 banda, 2 DC
function team(): PlayerResponse[] {
  return [
    player("gk", 1),
    player("li", 2), player("ld", 3),
    player("dfc1", 4), player("dfc2", 4), player("lib", 5),
    player("mc1", 6), player("mc2", 6), player("mc3", 6), player("mcd", 7),
    player("mco", 8),
    player("mi", 9), player("md", 10), player("ei", 13), player("ed", 14),
    player("dc", 11), player("sd", 12),
  ];
}

function unavailable(playerId: string, excuseTypeId: number, reason: string): Map<string, MatchUnavailability> {
  return new Map([[playerId, { excuseTypeId, reason }]]);
}

function input(matchUnavailable: Map<string, MatchUnavailability>, maxCalledPlayers: number): BuildProposalInput {
  const players = team();
  return {
    players,
    calledIds: players.map((p) => p.id),
    ratings: {},
    streaks: new Map(),
    technicalTotals: new Map(),
    seasonEvents: [],
    seasonColumns: [],
    enrichedGrid: new Map(),
    seasonStats: [],
    lastInjuryEndMap: new Map(),
    currentDate: "2026-10-16",
    currentEventId: null,
    currentRival: null,
    weekTrainingStats: new Map(),
    weekTrainingCount: 0,
    maxCalledPlayers,
    matchUnavailable,
  };
}

describe("buildDeconvokeProposal con jugadores no disponibles para el partido", () => {
  it("propone como obligatorio al jugador no disponible e indica el motivo", () => {
    const proposal = buildDeconvokeProposal(input(unavailable("mi", 3, "Enfermedad"), 30));

    const mi = proposal.players.find((p) => p.playerId === "mi")!;
    expect(proposal.selectedIds).toEqual(["mi"]);
    expect(mi.forced).toBe(true);
    expect(mi.factors.find((f) => f.key === "matchUnavailable")?.label).toBe(
      "No disponible para el partido: Enfermedad",
    );
  });

  it("el no disponible cuenta para el objetivo y no se desconvoca a nadie más", () => {
    const proposal = buildDeconvokeProposal(input(unavailable("mc2", 8, "Sanción deportiva"), 16));

    expect(proposal.targetCount).toBe(1);
    expect(proposal.selectedIds).toEqual(["mc2"]);
  });

  it("el no disponible no cubre los mínimos de posición", () => {
    const proposal = buildDeconvokeProposal(input(unavailable("dfc1", 2, "Estudios"), 30));

    expect(proposal.positionWarnings.map((w) => w.label)).toEqual(["Centrales"]);
  });
});
