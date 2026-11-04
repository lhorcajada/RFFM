import { step, renderSettledHook } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { deleteMatchParticipation } from "../../../../services/liveMatchService";
import { getFakeLiveMatchServer, resetFakeLiveMatchServer } from "./fakeLiveMatchServer";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  const fake = await import("./fakeLiveMatchServer");
  return {
    ...actual,
    ...fake.liveMatchServiceMocks(),
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";
const BACKUP_KEY = `rffm_live:${EVENT_ID}`;

describe("useLiveMatch - reinicio tras eliminar los datos del partido", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reinicia el partido a estado inicial (como una recarga de página) al eliminar los datos guardados", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.initMatch({ 0: "p1", 1: "p2" });
    });
    await step(() => {
      result.current.setPendingAction("startMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      result.current.addGoal("p1", "Player One", 9, true, null, null, 10);
    });
    await step(() => {
      result.current.addCard("p2", "Player Two", false, null, "yellow", 20, 1);
    });
    await step(() => {
      vi.advanceTimersByTime(5000);
    });
    await step(() => {
      result.current.setPendingAction("endFirstHalf");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      result.current.setPendingAction("startSecondHalf");
    });
    await step(() => {
      result.current.confirmAction();
    });
    await step(() => {
      result.current.setPendingAction("endMatch");
    });
    await step(() => {
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

  it("al eliminar un partido con estado en el servidor llama a deleteLiveMatch y no al borrado legado", async () => {
    const server = getFakeLiveMatchServer();
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });
    await step(() => {
      result.current.setPendingAction("startMatch");
    });
    await step(() => {
      result.current.confirmAction();
    });

    await act(async () => {
      await result.current.deleteParticipation();
    });

    expect(server.deleteLiveMatch).toHaveBeenCalledWith(EVENT_ID);
    expect(deleteMatchParticipation).not.toHaveBeenCalled();
  });
});
