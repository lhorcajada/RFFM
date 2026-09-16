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

describe("useConvocationPlayerViews - propagación de estado de asistencia", () => {
  it("incluye assistanceTypeId/excuseTypeId/excuseReasonName en lineupPlayers desde los mapas de entrada", () => {
    const { result } = renderHook(() =>
      useConvocationPlayerViews({
        players: [basePlayer()],
        mgmtNotCalled: [],
        mgmtPending: [],
        mgmtPhotos: {},
        mgmtRatings: {},
        matchColumns: [],
        enrichedGrid: new Map(),
        assistanceMap: { p1: 3 },
        excuseMap: { p1: 5 },
        excuseTypesById: new Map([[5, { name: "Lesión", justified: true }]]),
      }),
    );

    expect(result.current.lineupPlayers[0].assistanceTypeId).toBe(3);
    expect(result.current.lineupPlayers[0].excuseTypeId).toBe(5);
    expect(result.current.lineupPlayers[0].excuseReasonName).toBe("Lesión");
  });

  it("expone en notAttendingPlayers solo a los jugadores con AssistanceTypeId 2 o 3", () => {
    const { result } = renderHook(() =>
      useConvocationPlayerViews({
        players: [
          basePlayer({ id: "p1" }),
          basePlayer({ id: "p2" }),
          basePlayer({ id: "p3" }),
          basePlayer({ id: "p4" }),
        ],
        mgmtNotCalled: [],
        mgmtPending: [],
        mgmtPhotos: {},
        mgmtRatings: {},
        matchColumns: [],
        enrichedGrid: new Map(),
        assistanceMap: { p1: 2, p2: 3, p3: 4, p4: 1 },
      }),
    );

    const ids = result.current.notAttendingPlayers.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["p1", "p2"]));
    expect(ids).not.toContain("p3");
    expect(ids).not.toContain("p4");
  });

  it("deja los campos de asistencia en null cuando no hay mapas de entrada", () => {
    const { result } = renderHook(() =>
      useConvocationPlayerViews({
        players: [basePlayer()],
        mgmtNotCalled: [],
        mgmtPending: [],
        mgmtPhotos: {},
        mgmtRatings: {},
        matchColumns: [],
        enrichedGrid: new Map(),
      }),
    );

    expect(result.current.lineupPlayers[0].assistanceTypeId).toBeNull();
    expect(result.current.lineupPlayers[0].excuseTypeId).toBeNull();
    expect(result.current.lineupPlayers[0].excuseReasonName).toBeNull();
  });
});
