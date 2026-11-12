import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import { useConvocationProposal } from "../useConvocationProposal";

function player(id: string, activePositionId: number): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: [activePositionId] } as PlayerResponse;
}

const players = [player("gk", 1), player("dfc1", 4), player("mc1", 6), player("mc2", 6), player("dc", 11)];

function render(alreadyOutIds: Set<string>) {
  return renderHook(() =>
    useConvocationProposal({
      players,
      squadIds: players.map((p) => p.id),
      alreadyOutIds,
      ratings: {},
      playerStreaks: new Map(),
      playerTechnicalTotals: new Map(),
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
      gridStartsCountMap: new Map(),
      matchUnavailable: new Map(),
    }),
  ).result.current;
}

describe("useConvocationProposal con jugadores ya desconvocados", () => {
  it("la propuesta trabaja solo con los disponibles", () => {
    const proposal = render(new Set(["mc1", "mc2"]));

    expect(proposal.calledCount).toBe(3);
    expect(proposal.players.map((p) => p.playerId)).toEqual(expect.not.arrayContaining(["mc1", "mc2"]));
  });

  it("devuelve los ya desconvocados en alreadyDeconvoked", () => {
    const proposal = render(new Set(["mc1", "mc2"]));

    expect(proposal.alreadyDeconvoked.map((p) => p.playerId)).toEqual(["mc1", "mc2"]);
  });

  it("sin ya desconvocados cuenta a toda la plantilla", () => {
    expect(render(new Set()).calledCount).toBe(5);
  });
});
