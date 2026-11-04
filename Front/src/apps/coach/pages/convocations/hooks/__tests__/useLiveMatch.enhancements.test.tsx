import { step, renderSettledHook } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveMatch, MAX_TOTAL_WINDOWS, MAX_SECOND_HALF_WINDOWS } from "../useLiveMatch";
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

beforeEach(() => {
  resetFakeLiveMatchServer({ eventId: EVENT_ID });
});

async function startMatch(result: { current: ReturnType<typeof useLiveMatch> }, slots: Record<number, string | null>) {
  await step(() => {
    result.current.initMatch(slots);
  });
  await step(() => {
    result.current.setPendingAction("startMatch");
  });
  await step(() => {
    result.current.confirmAction();
  });
}

describe("useLiveMatch - unlimited substitution windows (friendlies)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps canOpenWindow true past the normal caps when unlimitedWindows is true", async () => {
    const { result } = await renderSettledHook(() =>
      useLiveMatch(EVENT_ID, TEAM_ID, true, { unlimitedWindows: true }),
    );
    await startMatch(result, { 0: "p1" });

    // Simulate having already opened MAX_TOTAL_WINDOWS windows by committing them
    for (let i = 0; i < MAX_TOTAL_WINDOWS + 2; i++) {
      await step(() => {
        result.current.startPrepare();
      });
      await step(() => {
        result.current.commitWindow({});
      });
    }

    expect(result.current.windowsTotal).toBeGreaterThan(MAX_TOTAL_WINDOWS);
    expect(result.current.canOpenWindow).toBe(true);
  });

  it("keeps the existing quota behavior unchanged when unlimitedWindows is false/default", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    for (let i = 0; i < MAX_TOTAL_WINDOWS; i++) {
      await step(() => {
        result.current.startPrepare();
      });
      await step(() => {
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

  it("addCard/removeCard update the cards state", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
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
    await step(() => {
      result.current.removeCard(cardId);
    });
    expect(result.current.cards).toHaveLength(0);
  });

  it("records a rival card with a free-text dorsal", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addCard(null, null, true, 4, "red");
    });

    expect(result.current.cards[0]).toMatchObject({
      teamPlayerId: null,
      isRivalPlayer: true,
      rivalDorsal: 4,
      cardType: "red",
    });
  });

  it("stores cardsJson matching the recorded cards on the server when the match is closed", async () => {
    const { saveMatchParticipation } = await import("../../../../services/liveMatchService");
    const server = getFakeLiveMatchServer();
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addCard("p1", "Jugador Uno", false, null, "yellow");
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
    await act(async () => {
      result.current.confirmAction();
    });

    expect(server.finishLiveMatch).toHaveBeenCalledTimes(1);
    expect(saveMatchParticipation).not.toHaveBeenCalled();
    const parsedCards = JSON.parse(server.state?.matchData.cardsJson ?? "[]");
    expect(parsedCards).toHaveLength(1);
    expect(parsedCards[0].teamPlayerId).toBe("p1");
  });
});

describe("useLiveMatch - goal pitch zone and body part", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores pitchZone and bodyPart on the resulting GoalEvent", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addGoal("p1", "Jugador Uno", 9, true, { col: 2, row: 7 }, "head");
    });

    expect(result.current.goals[0].pitchZone).toEqual({ col: 2, row: 7 });
    expect(result.current.goals[0].bodyPart).toBe("head");
  });

  it("defaults pitchZone/bodyPart to null when omitted (regression for existing calls)", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
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

  it("appends a FormationChangeEvent and updates slots/playerStates", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1", 1: "p2" });

    await step(() => {
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

  it("swaps two on-field players' slots without going through prepareMode", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1", 1: "p2" });

    await step(() => {
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

  it("moving into an empty slot just relocates the player", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.repositionPlayer(0, 3);
    });

    expect(result.current.slots).toEqual({ 0: null, 3: "p1" });
    expect(result.current.playerStates.p1.slotIndex).toBe(3);
  });

  it("is a no-op while a substitution window is being prepared", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1", 1: "p2" });

    await step(() => {
      result.current.startPrepare();
    });
    await step(() => {
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

  it("addGoal uses currentMinute by default", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addGoal("p1", "Jugador Uno", 9, true);
    });

    expect(result.current.goals[0].minute).toBe(0);
  });

  it("addGoal respects an explicit minute parameter", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addGoal("p1", "Jugador Uno", 9, true, null, null, 45);
    });

    expect(result.current.goals[0].minute).toBe(45);
  });

  it("addCard uses currentMinute and currentHalf by default", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addCard("p1", "Jugador Uno", false, null, "yellow");
    });

    expect(result.current.cards[0].minute).toBe(0);
    expect(result.current.cards[0].half).toBe(1);
  });

  it("addCard respects explicit minute and half parameters", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addCard("p1", "Jugador Uno", false, null, "yellow", 20, 2);
    });

    expect(result.current.cards[0].minute).toBe(20);
    expect(result.current.cards[0].half).toBe(2);
  });
});

describe("useLiveMatch - updateGoal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("updateGoal replaces goal fields and recomputes scoreAtMoment for all goals", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1", 1: "p2" });

    // Add two goals for own team
    await step(() => {
      result.current.addGoal("p1", "Player One", 9, true);
    });
    await step(() => {
      result.current.addGoal("p2", "Player Two", 10, true);
    });

    expect(result.current.scoreLocal).toBe(2);
    expect(result.current.scoreVisitor).toBe(0);
    expect(result.current.goals[0].scoreAtMoment).toEqual({ local: 1, visitor: 0 });
    expect(result.current.goals[1].scoreAtMoment).toEqual({ local: 2, visitor: 0 });

    const goalId = result.current.goals[0].id;

    // Change first goal to be for rival team
    await step(() => {
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

  it("updateGoal patches partial fields", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addGoal("p1", "Player One", 9, true, { col: 1, row: 2 }, "head");
    });

    const goalId = result.current.goals[0].id;

    await step(() => {
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

  it("updateCard patches card fields", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });

    await step(() => {
      result.current.addCard("p1", "Player One", false, null, "yellow");
    });

    const cardId = result.current.cards[0].id;

    await step(() => {
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

    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

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

    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

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

describe("useLiveMatch - corrección manual de ventanas de cambios", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("sustituye las ventanas registradas por las corregidas", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await startMatch(result, { 0: "p1" });
    await step(() => {
      result.current.startPrepare();
    });
    await step(() => {
      result.current.commitWindow({});
    });

    await step(() => {
      result.current.replaceWindows([]);
    });

    expect(result.current.windows).toEqual([]);
  });
});
