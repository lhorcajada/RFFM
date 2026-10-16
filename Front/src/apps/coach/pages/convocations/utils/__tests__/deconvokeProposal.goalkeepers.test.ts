import { describe, expect, it } from "vitest";
import { buildDeconvokeProposal, selectDeconvocations, type BuildProposalInput } from "../deconvokeProposal";
import type { MatchUnavailability } from "../matchUnavailability";
import type { PlayerResponse } from "../../../../services/teamplayerService";

function player(id: string, activePositionId: number | null, extra: Partial<PlayerResponse> = {}): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: activePositionId ? [activePositionId] : [], ...extra };
}

// 2 POR (primeros en el orden), 2 LAT, 3 DFC, 4 MC, 1 MCO, 4 banda, 2 DC
function team(overrides: Record<string, Partial<PlayerResponse>> = {}): PlayerResponse[] {
  return [
    player("gk1", 1), player("gk2", 1),
    player("li", 2), player("ld", 3),
    player("dfc1", 4), player("dfc2", 4), player("lib", 5),
    player("mc1", 6), player("mc2", 6), player("mc3", 6), player("mcd", 7),
    player("mco", 8),
    player("mi", 9), player("md", 10), player("ei", 13), player("ed", 14),
    player("dc", 11), player("sd", 12),
  ].map((p) => ({ ...p, ...overrides[p.id] }));
}

function input(
  players: PlayerResponse[],
  maxCalledPlayers: number,
  extra: Partial<BuildProposalInput> = {},
): BuildProposalInput {
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
    ...extra,
  };
}

function unavailable(playerId: string, excuseTypeId: number, reason: string): Map<string, MatchUnavailability> {
  return new Map([[playerId, { excuseTypeId, reason }]]);
}

describe("buildDeconvokeProposal — los porteros siempre van convocados", () => {
  it("no propone a ningún portero aunque tengan la puntuación más baja", () => {
    const proposal = buildDeconvokeProposal(input(team(), 17));

    expect(proposal.selectedIds).toHaveLength(1);
    expect(proposal.selectedIds).not.toContain("gk1");
    expect(proposal.selectedIds).not.toContain("gk2");
  });

  it("indica en el portero que siempre va convocado", () => {
    const proposal = buildDeconvokeProposal(input(team(), 17));

    const gk = proposal.players.find((p) => p.playerId === "gk1")!;
    expect(gk.factors.find((f) => f.key === "goalkeeperAlwaysCalled")?.label).toBe(
      "Portero: siempre convocado salvo lesión o sanción",
    );
  });

  it("no propone al portero aunque otra regla obligatoria lo desconvoque", () => {
    const weekStats = {
      totalTrainings: 2,
      attendedTrainings: 0,
      weightedAttendedTrainings: 0,
      attendedTrainingsSeason: 0,
      weightedAttendedTrainingsSeason: 0,
      totalTrainingsSeason: 0,
      knownUnavailableTrainings: 2,
    };
    const proposal = buildDeconvokeProposal(
      input(team(), 30, { weekTrainingStats: new Map([["gk2", weekStats]]), weekTrainingCount: 2 }),
    );

    const gk = proposal.players.find((p) => p.playerId === "gk2")!;
    expect(gk.forced).toBe(false);
    expect(proposal.selectedIds).toEqual([]);
  });

  it("propone al portero lesionado", () => {
    const proposal = buildDeconvokeProposal(input(team({ gk2: { isInjured: true } }), 30));

    expect(proposal.selectedIds).toEqual(["gk2"]);
  });

  it("propone al portero desconvocado por lesión", () => {
    const proposal = buildDeconvokeProposal(
      input(team(), 30, { matchUnavailable: unavailable("gk2", 1, "Lesión") }),
    );

    expect(proposal.selectedIds).toEqual(["gk2"]);
  });

  it("propone al portero sancionado", () => {
    const proposal = buildDeconvokeProposal(
      input(team(), 30, { matchUnavailable: unavailable("gk2", 8, "Sanción deportiva") }),
    );

    expect(proposal.selectedIds).toEqual(["gk2"]);
  });

  it("no propone al portero desconvocado por un motivo que no es lesión ni sanción", () => {
    const proposal = buildDeconvokeProposal(
      input(team(), 30, { matchUnavailable: unavailable("gk2", 3, "Enfermedad") }),
    );

    expect(proposal.selectedIds).toEqual([]);
  });
});

describe("selectDeconvocations con candidatos bloqueados", () => {
  it("nunca selecciona un candidato bloqueado aunque no se alcance el objetivo", () => {
    const players = new Map([
      ["gk1", { id: "gk1", role: "goalkeeper" as const, possibleRoles: [] }],
      ["gk2", { id: "gk2", role: "goalkeeper" as const, possibleRoles: [] }],
    ]);
    const ordered = [
      { playerId: "gk1", forced: false, locked: true },
      { playerId: "gk2", forced: false, locked: true },
    ];

    expect(selectDeconvocations(ordered, players, 1).selectedIds).toEqual([]);
  });
});
