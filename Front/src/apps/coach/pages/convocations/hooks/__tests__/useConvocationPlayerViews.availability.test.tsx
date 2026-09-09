import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useConvocationPlayerViews } from "../useConvocationPlayerViews";
import type { PlayerResponse } from "../../../../services/teamplayerService";

function basePlayer(overrides: Partial<PlayerResponse> = {}): PlayerResponse {
  return {
    id: "p1",
    name: "Jugador",
    lastName: "Uno",
    alias: null,
    dorsal: 7,
    position: "Delantero",
    isInjured: false,
    ...overrides,
  } as PlayerResponse;
}

describe("useConvocationPlayerViews - propagación de condición física", () => {
  it("incluye availability/physicalFitness/fatigue en lineupPlayers desde readinessMap", () => {
    const { result } = renderHook(() =>
      useConvocationPlayerViews({
        players: [basePlayer()],
        mgmtNotCalled: [],
        mgmtPending: [],
        mgmtPhotos: {},
        mgmtRatings: {},
        matchColumns: [],
        enrichedGrid: new Map(),
        readinessMap: {
          p1: {
            readiness: 60,
            availability: 33,
            physicalFitness: 55,
            fatigue: 22,
          },
        },
      }),
    );

    expect(result.current.lineupPlayers[0].availability).toBe(33);
    expect(result.current.lineupPlayers[0].physicalFitness).toBe(55);
    expect(result.current.lineupPlayers[0].fatigue).toBe(22);
  });
});
