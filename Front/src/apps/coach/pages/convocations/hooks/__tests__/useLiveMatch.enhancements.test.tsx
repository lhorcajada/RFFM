import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch, MAX_TOTAL_WINDOWS, MAX_SECOND_HALF_WINDOWS } from "../useLiveMatch";

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

function startMatch(result: { current: ReturnType<typeof useLiveMatch> }, slots: Record<number, string | null>) {
  act(() => {
    result.current.initMatch(slots);
  });
  act(() => {
    result.current.setPendingAction("startMatch");
  });
  act(() => {
    result.current.confirmAction();
  });
}

describe("useLiveMatch - unlimited substitution windows (friendlies)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps canOpenWindow true past the normal caps when unlimitedWindows is true", () => {
    const { result } = renderHook(() =>
      useLiveMatch(EVENT_ID, TEAM_ID, true, { unlimitedWindows: true }),
    );
    startMatch(result, { 0: "p1" });

    // Simulate having already opened MAX_TOTAL_WINDOWS windows by committing them
    for (let i = 0; i < MAX_TOTAL_WINDOWS + 2; i++) {
      act(() => {
        result.current.startPrepare();
      });
      act(() => {
        result.current.commitWindow({});
      });
    }

    expect(result.current.windowsTotal).toBeGreaterThan(MAX_TOTAL_WINDOWS);
    expect(result.current.canOpenWindow).toBe(true);
  });

  it("keeps the existing quota behavior unchanged when unlimitedWindows is false/default", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    for (let i = 0; i < MAX_TOTAL_WINDOWS; i++) {
      act(() => {
        result.current.startPrepare();
      });
      act(() => {
        result.current.commitWindow({});
      });
    }

    expect(result.current.windowsTotal).toBe(MAX_TOTAL_WINDOWS);
    expect(result.current.canOpenWindow).toBe(false);
  });
});

describe("useLiveMatch - cards", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("addCard/removeCard update the cards state", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addCard("p1", "Jugador Uno", false, null, "yellow");
    });

    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0]).toMatchObject({
      teamPlayerId: "p1",
      playerName: "Jugador Uno",
      isRivalPlayer: false,
      rivalDorsal: null,
      cardType: "yellow",
    });

    const cardId = result.current.cards[0].id;
    act(() => {
      result.current.removeCard(cardId);
    });
    expect(result.current.cards).toHaveLength(0);
  });

  it("records a rival card with a free-text dorsal", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addCard(null, null, true, 4, "red");
    });

    expect(result.current.cards[0]).toMatchObject({
      teamPlayerId: null,
      isRivalPlayer: true,
      rivalDorsal: 4,
      cardType: "red",
    });
  });

  it("includes cardsJson matching the recorded cards when persisting participation", async () => {
    const { saveMatchParticipation } = await import("../../../../services/liveMatchService");
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addCard("p1", "Jugador Uno", false, null, "yellow");
    });
    act(() => {
      result.current.setPendingAction("endMatch");
    });
    act(() => {
      result.current.confirmAction();
    });
    act(() => {
      result.current.requestSave();
    });
    await act(async () => {
      result.current.confirmSave();
    });

    expect(saveMatchParticipation).toHaveBeenCalled();
    const payload = (saveMatchParticipation as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const parsedCards = JSON.parse(payload.cardsJson);
    expect(parsedCards).toHaveLength(1);
    expect(parsedCards[0].teamPlayerId).toBe("p1");
  });
});

describe("useLiveMatch - goal pitch zone and body part", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores pitchZone and bodyPart on the resulting GoalEvent", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addGoal("p1", "Jugador Uno", 9, true, { col: 2, row: 7 }, "head");
    });

    expect(result.current.goals[0].pitchZone).toEqual({ col: 2, row: 7 });
    expect(result.current.goals[0].bodyPart).toBe("head");
  });

  it("defaults pitchZone/bodyPart to null when omitted (regression for existing calls)", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addGoal(null, null, null, false, null, null);
    });

    expect(result.current.goals[0].pitchZone).toBeNull();
    expect(result.current.goals[0].bodyPart).toBeNull();
  });
});

describe("useLiveMatch - mid-match formation change", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("appends a FormationChangeEvent and updates slots/playerStates", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1", 1: "p2" });

    act(() => {
      result.current.changeFormation("f2", "4-3-3", { 0: "p1", 1: null, 2: "p2" });
    });

    expect(result.current.formationChanges).toHaveLength(1);
    expect(result.current.formationChanges[0]).toMatchObject({
      formationId: "f2",
      formationName: "4-3-3",
      slotsAfter: { 0: "p1", 1: null, 2: "p2" },
    });
    expect(result.current.slots).toEqual({ 0: "p1", 1: null, 2: "p2" });
    expect(result.current.playerStates.p2.isOnField).toBe(true);
    expect(result.current.playerStates.p2.slotIndex).toBe(2);
  });
});

describe("useLiveMatch - free field repositioning (no substitution window)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("swaps two on-field players' slots without going through prepareMode", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1", 1: "p2" });

    act(() => {
      result.current.repositionPlayer(0, 1);
    });

    expect(result.current.slots).toEqual({ 0: "p2", 1: "p1" });
    expect(result.current.playerStates.p1.slotIndex).toBe(1);
    expect(result.current.playerStates.p2.slotIndex).toBe(0);
    // Repositioning must not touch minutes bookkeeping or count as a substitution
    expect(result.current.playerStates.p1.isOnField).toBe(true);
    expect(result.current.playerStates.p2.isOnField).toBe(true);
    expect(result.current.windows).toHaveLength(0);
  });

  it("moving into an empty slot just relocates the player", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.repositionPlayer(0, 3);
    });

    expect(result.current.slots).toEqual({ 0: null, 3: "p1" });
    expect(result.current.playerStates.p1.slotIndex).toBe(3);
  });

  it("is a no-op while a substitution window is being prepared", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1", 1: "p2" });

    act(() => {
      result.current.startPrepare();
    });
    act(() => {
      result.current.repositionPlayer(0, 1);
    });

    // Real slots (not the prepare preview) must remain untouched
    expect(result.current.slots).toEqual({ 0: "p1", 1: "p2" });
  });
});
