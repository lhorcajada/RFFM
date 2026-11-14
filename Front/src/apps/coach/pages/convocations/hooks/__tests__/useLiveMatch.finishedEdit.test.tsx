import { renderSettledHook, resetFakeLiveMatchServer } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { getMatchParticipation } from "../../../../services/liveMatchService";
import type { GoalEvent } from "../../components/simulation/liveMatch.types";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  const fake = await import("./fakeLiveMatchServer");
  return {
    ...actual,
    ...fake.liveMatchServiceMocks(),
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn(),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";

const goal = (id: string, minute: number): GoalEvent => ({
  id,
  minute,
  scorerId: "p1",
  scorerName: "Player One",
  scorerDorsal: 9,
  isOwnTeam: true,
  scoreAtMoment: { local: 1, visitor: 0 },
  pitchZone: null,
  bodyPart: null,
});

describe("useLiveMatch — partido finalizado con edición manual guardada", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getMatchParticipation).mockReset();
  });

  it("al volver a entrar muestra los goles y el resultado guardados en la edición manual, no los del estado cerrado del directo", async () => {
    resetFakeLiveMatchServer({
      eventId: EVENT_ID,
      teamId: TEAM_ID,
      initialState: {
        eventId: EVENT_ID,
        teamId: TEAM_ID,
        version: 9,
        phase: "finished",
        clock: { baseSeconds: 3600, referenceUtc: null },
        matchDurationMinutes: 60,
        scoreLocal: 1,
        scoreVisitor: 0,
        formation: null,
        matchData: {
          startingLineupJson: null,
          playersJson: null,
          substitutionWindowsJson: null,
          ratingSnapshotsJson: null,
          goalsJson: JSON.stringify([goal("g1", 10)]),
          cardsJson: null,
          formationChangesJson: null,
        },
        isClosed: true,
        serverNowUtc: new Date().toISOString(),
      },
    });
    vi.mocked(getMatchParticipation).mockResolvedValue({
      teamId: TEAM_ID,
      scoreLocal: 2,
      scoreVisitor: 0,
      matchPhase: "finished",
      players: [],
      goalsJson: JSON.stringify([goal("g1", 10), goal("g2", 40)]),
      matchDurationMinutes: 60,
    });

    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await waitFor(() => expect(result.current.goals).toHaveLength(2));
    expect(result.current.scoreLocal).toBe(2);
  });
});
