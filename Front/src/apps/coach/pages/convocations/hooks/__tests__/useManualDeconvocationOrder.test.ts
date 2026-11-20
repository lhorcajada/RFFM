import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { DeconvokeProposal, PlayerProposal, ProposalOrderEntry } from "../../utils/deconvokeProposal";
import type { PlayerResponse } from "../../../../services/teamplayerService";
import { useManualDeconvocationOrder } from "../useManualDeconvocationOrder";

function entry(rank: number, id: string, outcome: ProposalOrderEntry["outcome"]): ProposalOrderEntry {
  return { rank, playerId: id, name: id, position: "Central", outcome, chips: [], versusNext: null };
}

function proposedPlayer(id: string, group: "proposed" | "notChosen"): PlayerProposal {
  return {
    playerId: id,
    displayName: id,
    position: "Central",
    positionRole: "centreBack",
    isSelected: group === "proposed",
    forced: false,
    locked: false,
    score: 0,
    factors: [],
    summary: "",
    calledCount: 5,
    startsCount: 1,
    startsDataAvailable: true,
    minRequiredCalls: 4,
    weeklyTraining: {
      totalTrainings: 0,
      attendedTrainings: 0,
      weightedAttendedTrainings: 0,
      attendedTrainingsSeason: 0,
      weightedAttendedTrainingsSeason: 0,
      totalTrainingsSeason: 0,
      knownUnavailableTrainings: 0,
    },
    decision: { group, reason: "" },
    detail: [],
    comparison: [],
  };
}

const AUTOMATIC: DeconvokeProposal = {
  generatedAt: "2026-10-14T10:00:00.000Z",
  rivalDifficulty: "medium",
  schedule: { upcoming: [], reservedIn: null, reservedNames: [], strongCount: 0, maxStrong: 0 },
  targetCount: 1,
  calledCount: 3,
  selectedIds: ["a"],
  previousRivalResult: null,
  players: [proposedPlayer("a", "proposed"), proposedPlayer("b", "notChosen"), proposedPlayer("c", "notChosen")],
  positionWarnings: [],
  alreadyDeconvoked: [],
  order: [entry(1, "a", "proposed"), entry(2, "b", "stays"), entry(3, "c", "stays")],
};

const PLAYERS = [] as PlayerResponse[];

describe("useManualDeconvocationOrder", () => {
  it("mientras no se mueve a nadie devuelve la propuesta automática tal cual", () => {
    const { result } = renderHook(() => useManualDeconvocationOrder(AUTOMATIC, { players: PLAYERS }));

    expect(result.current.proposal).toBe(AUTOMATIC);
  });

  it("al bajar al primero entra el siguiente en la selección", () => {
    const { result } = renderHook(() => useManualDeconvocationOrder(AUTOMATIC, { players: PLAYERS }));

    act(() => result.current.moveInOrder("a", "down"));

    expect(result.current.proposal.isManual).toBe(true);
    expect(result.current.proposal.order.map((o) => o.playerId)).toEqual(["b", "a", "c"]);
    expect(result.current.proposal.selectedIds).toEqual(["b"]);
  });

  it("al subir a un jugador sin salir del orden lo adelanta una posición", () => {
    const { result } = renderHook(() => useManualDeconvocationOrder(AUTOMATIC, { players: PLAYERS }));

    act(() => result.current.moveInOrder("c", "up"));

    expect(result.current.proposal.order.map((o) => o.playerId)).toEqual(["a", "c", "b"]);
  });

  it("varios movimientos seguidos se acumulan", () => {
    const { result } = renderHook(() => useManualDeconvocationOrder(AUTOMATIC, { players: PLAYERS }));

    act(() => result.current.moveInOrder("c", "up"));
    act(() => result.current.moveInOrder("c", "up"));

    expect(result.current.proposal.order.map((o) => o.playerId)).toEqual(["c", "a", "b"]);
    expect(result.current.proposal.selectedIds).toEqual(["c"]);
  });

  it("mover al primero hacia arriba o al último hacia abajo no cambia nada", () => {
    const { result } = renderHook(() => useManualDeconvocationOrder(AUTOMATIC, { players: PLAYERS }));

    act(() => result.current.moveInOrder("a", "up"));
    act(() => result.current.moveInOrder("c", "down"));

    expect(result.current.proposal).toBe(AUTOMATIC);
  });

  it("al restablecer vuelve la propuesta automática", () => {
    const { result } = renderHook(() => useManualDeconvocationOrder(AUTOMATIC, { players: PLAYERS }));
    act(() => result.current.moveInOrder("a", "down"));

    act(() => result.current.resetOrder());

    expect(result.current.proposal).toBe(AUTOMATIC);
  });
});
