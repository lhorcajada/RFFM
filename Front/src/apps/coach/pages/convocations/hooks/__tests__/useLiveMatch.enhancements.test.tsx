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

describe("useLiveMatch - addGoal/addCard with explicit minute/half", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("addGoal uses currentMinute by default", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addGoal("p1", "Jugador Uno", 9, true);
    });

    expect(result.current.goals[0].minute).toBe(0);
  });

  it("addGoal respects an explicit minute parameter", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addGoal("p1", "Jugador Uno", 9, true, null, null, 45);
    });

    expect(result.current.goals[0].minute).toBe(45);
  });

  it("addCard uses currentMinute and currentHalf by default", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addCard("p1", "Jugador Uno", false, null, "yellow");
    });

    expect(result.current.cards[0].minute).toBe(0);
    expect(result.current.cards[0].half).toBe(1);
  });

  it("addCard respects explicit minute and half parameters", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addCard("p1", "Jugador Uno", false, null, "red", 20, 2);
    });

    expect(result.current.cards[0].minute).toBe(20);
    expect(result.current.cards[0].half).toBe(2);
  });
});

describe("useLiveMatch - updateGoal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("updateGoal replaces goal fields and recomputes scoreAtMoment for all goals", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1", 1: "p2" });

    // Add two goals for own team
    act(() => {
      result.current.addGoal("p1", "Player One", 9, true);
    });
    act(() => {
      result.current.addGoal("p2", "Player Two", 10, true);
    });

    expect(result.current.scoreLocal).toBe(2);
    expect(result.current.scoreVisitor).toBe(0);
    expect(result.current.goals[0].scoreAtMoment).toEqual({ local: 1, visitor: 0 });
    expect(result.current.goals[1].scoreAtMoment).toEqual({ local: 2, visitor: 0 });

    const goalId = result.current.goals[0].id;

    // Change first goal to be for rival team
    act(() => {
      result.current.updateGoal(goalId, {
        scorerId: null,
        scorerName: "Rival",
        scorerDorsal: 5,
        isOwnTeam: false,
        pitchZone: null,
        bodyPart: null,
      });
    });

    // Scores should remain the same (score is computed in the right columns)
    expect(result.current.scoreLocal).toBe(1); // Own goal removed from local
    expect(result.current.scoreVisitor).toBe(1); // Rival goal added to visitor
    // scoreAtMoment should be recomputed
    expect(result.current.goals[0].scoreAtMoment).toEqual({ local: 0, visitor: 1 });
    expect(result.current.goals[1].scoreAtMoment).toEqual({ local: 1, visitor: 1 });
  });

  it("updateGoal patches partial fields", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addGoal("p1", "Player One", 9, true, { col: 1, row: 2 }, "head");
    });

    const goalId = result.current.goals[0].id;

    act(() => {
      result.current.updateGoal(goalId, {
        bodyPart: "foot",
      });
    });

    expect(result.current.goals[0].bodyPart).toBe("foot");
    expect(result.current.goals[0].scorerId).toBe("p1"); // unchanged
    expect(result.current.goals[0].pitchZone).toEqual({ col: 1, row: 2 }); // unchanged
  });
});

describe("useLiveMatch - updateCard", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("updateCard patches card fields", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    startMatch(result, { 0: "p1" });

    act(() => {
      result.current.addCard("p1", "Player One", false, null, "yellow");
    });

    const cardId = result.current.cards[0].id;

    act(() => {
      result.current.updateCard(cardId, {
        cardType: "red",
        minute: 45,
      });
    });

    expect(result.current.cards[0].cardType).toBe("red");
    expect(result.current.cards[0].minute).toBe(45);
    expect(result.current.cards[0].teamPlayerId).toBe("p1"); // unchanged
  });
});

describe("useLiveMatch - reopening a saved finished match (race-safe hydration)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hydrates match state when getMatchParticipation resolves BEFORE initMatch is called", async () => {
    const { getMatchParticipation } = await import("../../../../services/liveMatchService");
    const savedGoals = [
      {
        id: "g1",
        minute: 25,
        scorerId: "p1",
        scorerName: "Scorer",
        scorerDorsal: 9,
        isOwnTeam: true,
        scoreAtMoment: { local: 1, visitor: 0 },
        pitchZone: null,
        bodyPart: null,
      },
    ];
    const savedCards = [
      {
        id: "c1",
        minute: 30,
        half: 1,
        cardType: "yellow" as const,
        teamPlayerId: "p1",
        playerName: "Player",
        isRivalPlayer: false,
        rivalDorsal: null,
      },
    ];
    const savedParticipation = {
      teamId: TEAM_ID,
      scoreLocal: 1,
      scoreVisitor: 0,
      matchPhase: "finished" as const,
      players: [
        { teamPlayerId: "p1", minutesPlayed: 90, isStarter: true, enteredAtMinute: 0, exitedAtMinute: null },
        { teamPlayerId: "p2", minutesPlayed: 45, isStarter: false, enteredAtMinute: 45, exitedAtMinute: 90 },
      ],
      substitutionWindowsJson: "[]",
      ratingSnapshotsJson: "[]",
      goalsJson: JSON.stringify(savedGoals),
      cardsJson: JSON.stringify(savedCards),
      formationChangesJson: "[]",
    };

    // Pre-resolve the getMatchParticipation fetch
    (getMatchParticipation as ReturnType<typeof vi.fn>).mockResolvedValueOnce(savedParticipation);

    // Wait for the fetch to settle before rendering (simulating that it has already resolved)
    await new Promise((resolve) => setTimeout(resolve, 0));

    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    // Manually call initMatch as the component would
    await act(async () => {
      result.current.initMatch({ 0: "p1", 1: "p2" });
    });

    // Despite calling initMatch, the hook should have hydrated from saved data
    expect(result.current.matchPhase).toBe("finished");
    expect(result.current.scoreLocal).toBe(1);
    expect(result.current.scoreVisitor).toBe(0);
    expect(result.current.goals).toEqual(savedGoals);
    expect(result.current.cards).toEqual(savedCards);
  });

  it("hydrates match state when getMatchParticipation resolves AFTER initMatch is called", async () => {
    const { getMatchParticipation } = await import("../../../../services/liveMatchService");
    const savedGoals = [
      {
        id: "g2",
        minute: 35,
        scorerId: "p2",
        scorerName: "Scorer Two",
        scorerDorsal: 10,
        isOwnTeam: false,
        scoreAtMoment: { local: 0, visitor: 1 },
        pitchZone: null,
        bodyPart: null,
      },
    ];
    const savedCards: any[] = [];
    const savedParticipation = {
      teamId: TEAM_ID,
      scoreLocal: 0,
      scoreVisitor: 1,
      matchPhase: "finished" as const,
      players: [
        { teamPlayerId: "p1", minutesPlayed: 80, isStarter: true, enteredAtMinute: 0, exitedAtMinute: 80 },
      ],
      substitutionWindowsJson: "[]",
      ratingSnapshotsJson: "[]",
      goalsJson: JSON.stringify(savedGoals),
      cardsJson: JSON.stringify(savedCards),
      formationChangesJson: "[]",
    };

    // Make getMatchParticipation resolve slowly, AFTER initMatch
    let resolveGetMatch: (value: any) => void;
    (getMatchParticipation as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveGetMatch = resolve;
        }),
    );

    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    // Call initMatch first (resets state to preMatch)
    await act(async () => {
      result.current.initMatch({ 0: "p1" });
    });

    expect(result.current.matchPhase).toBe("preMatch");
    expect(result.current.scoreLocal).toBe(0);
    expect(result.current.scoreVisitor).toBe(0);
    expect(result.current.goals).toEqual([]);

    // Now let the fetch resolve
    await act(async () => {
      resolveGetMatch!(savedParticipation);
    });

    // The hook should have hydrated the saved state
    expect(result.current.matchPhase).toBe("finished");
    expect(result.current.scoreLocal).toBe(0);
    expect(result.current.scoreVisitor).toBe(1);
    expect(result.current.goals).toEqual(savedGoals);
    expect(result.current.cards).toEqual(savedCards);
  });
});
