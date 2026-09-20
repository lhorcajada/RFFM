import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useConvocationPlayerViews } from "../useConvocationPlayerViews";
import type { PlayerResponse } from "../../../../services/teamplayerService";

const player = { id: "p1", name: "Jugador", lastName: "Uno", alias: null, dorsal: 7, position: "Delantero", isInjured: false } as PlayerResponse;

function run(readinessMap: Parameters<typeof useConvocationPlayerViews>[0]["readinessMap"], lists: { notCalled?: string[]; pending?: string[] } = {}) {
  return renderHook(() =>
    useConvocationPlayerViews({
      players: [player],
      mgmtNotCalled: lists.notCalled ?? [],
      mgmtPending: lists.pending ?? [],
      mgmtPhotos: {},
      mgmtRatings: {},
      matchColumns: [],
      enrichedGrid: new Map(),
      readinessMap,
    }),
  ).result.current;
}

describe("useConvocationPlayerViews - propagación de formStatus", () => {
  it("incluye formStatus en lineupPlayers desde readinessMap", () => {
    expect(run({ p1: { readiness: 60, formStatus: 41 } }).lineupPlayers[0].formStatus).toBe(41);
  });

  it("incluye formStatus en notCalledPlayers y pendingPlayers", () => {
    const map = { p1: { readiness: 60, formStatus: 41 } };

    expect(run(map, { notCalled: ["p1"] }).notCalledPlayers[0].formStatus).toBe(41);
    expect(run(map, { pending: ["p1"] }).pendingPlayers[0].formStatus).toBe(41);
  });

  it("deja formStatus undefined cuando no hay entrada en readinessMap", () => {
    expect(run({}).lineupPlayers[0].formStatus).toBeUndefined();
  });

  it("conserva null cuando el backend no tiene datos", () => {
    expect(run({ p1: { readiness: 60, formStatus: null } }).lineupPlayers[0].formStatus).toBeNull();
  });
});
