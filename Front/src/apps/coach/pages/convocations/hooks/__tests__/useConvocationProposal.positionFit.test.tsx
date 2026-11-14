import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import type { PositionFit } from "../../../../types/positionFit";
import { useConvocationProposal } from "../useConvocationProposal";

function player(id: string, activePositionId: number): PlayerResponse {
  return { id, name: id, alias: id, activePositionId, possibleDemarcationIds: [activePositionId] } as PlayerResponse;
}

// 19 jugadores y 18 convocables: hay que desconvocar a uno; los medios centro tienen margen.
const players = [
  player("gk1", 1), player("gk2", 1),
  player("lat1", 2), player("lat2", 3), player("lat3", 2),
  player("dfc1", 4), player("dfc2", 4), player("dfc3", 5),
  player("mc1", 6), player("mc2", 6), player("mc3", 6), player("mc4", 6), player("mc5", 6), player("mc6", 6),
  player("ei", 13), player("ed", 14), player("ei2", 13),
  player("dc", 11), player("dc2", 11),
];

const midfielderIds = ["mc1", "mc2", "mc3", "mc4", "mc5", "mc6"];

const positionFit: PositionFit[] = [
  {
    position: "midfielder",
    confirmedWeekStart: null,
    isManual: false,
    weights: {},
    candidates: midfielderIds.map((id, index) => ({ teamPlayerId: id, name: id, place: index + 1, fit: 5 - index * 0.5, trend: "same" })),
  },
];

function render(withFit: boolean) {
  return renderHook(() =>
    useConvocationProposal({
      players,
      squadIds: players.map((p) => p.id),
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
      positionFit: withFit ? positionFit : undefined,
    }),
  ).result.current;
}

describe("useConvocationProposal con el encaje por puesto", () => {
  it("desconvoca al de peor encaje de su puesto", () => {
    expect(render(true).selectedIds).toEqual(["mc6"]);
  });

  it("sin encaje mantiene el orden de equidad", () => {
    expect(render(false).selectedIds).not.toEqual(["mc6"]);
  });
});
