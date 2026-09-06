import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  return {
    ...actual,
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
  };
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";
const BACKUP_KEY = `rffm_live:${EVENT_ID}`;

describe("useLiveMatch - reinicio tras eliminar los datos del partido", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reinicia el partido a estado inicial (como una recarga de página) al eliminar los datos guardados", async () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.initMatch({ 0: "p1", 1: "p2" });
    });
    act(() => {
      result.current.setPendingAction("startMatch");
    });
    act(() => {
      result.current.confirmAction();
    });
    act(() => {
      result.current.addGoal("p1", "Player One", 9, true, null, null, 10);
    });
    act(() => {
      result.current.addCard("p2", "Player Two", false, null, "yellow", 20, 1);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    act(() => {
      result.current.setPendingAction("endMatch");
    });
    act(() => {
      result.current.confirmAction();
    });

    expect(result.current.matchPhase).toBe("finished");
    expect(result.current.goals.length).toBe(1);
    expect(result.current.cards.length).toBe(1);
    expect(result.current.scoreLocal).toBe(1);

    await act(async () => {
      await result.current.deleteParticipation();
    });

    expect(result.current.matchPhase).toBe("preMatch");
    expect(result.current.goals).toEqual([]);
    expect(result.current.cards).toEqual([]);
    expect(result.current.scoreLocal).toBe(0);
    expect(result.current.scoreVisitor).toBe(0);
    expect(result.current.currentMinute).toBe(0);
    expect(result.current.currentSecond).toBe(0);
    expect(result.current.hasSavedData).toBe(false);
    expect(result.current.savedParticipationData).toBeNull();
    // Original lineup should still be restored on field, minutes back to zero
    expect(result.current.slots).toEqual({ 0: "p1", 1: "p2" });

    // No stale backup left behind either
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });
});
