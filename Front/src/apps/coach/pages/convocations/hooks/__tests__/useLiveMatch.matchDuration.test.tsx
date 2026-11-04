import { step, renderSettledHook, waitForAsync } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { getMatchParticipation, saveMatchParticipation } from "../../../../services/liveMatchService";
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

const EVENT_ID = "event-duration";
const TEAM_ID = "team-abc";

type Hook = { current: ReturnType<typeof useLiveMatch> };

async function playAndEnd(result: Hook, playedMs: number) {
  await step(() => {
    result.current.initMatch({ 0: "p1" });
  });
  await step(() => {
    result.current.setPendingAction("startMatch");
  });
  await step(() => {
    result.current.confirmAction();
  });
  await step(() => {
    vi.advanceTimersByTime(playedMs);
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
}

describe("useLiveMatch - duración del partido", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("al terminar rellena la duración con el minuto final del cronómetro", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await playAndEnd(result, 83 * 60 * 1000);

    expect(result.current.matchDurationMinutes).toBe(83);
  });

  it("sin cronómetro usa 2 × los minutos por parte configurados", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await step(() => {
      result.current.setHalfDuration(40);
    });

    await playAndEnd(result, 5000);

    expect(result.current.matchDurationMinutes).toBe(80);
  });

  it("antes del inicio la duración configurada se envía al servidor con setDuration", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await step(() => {
      result.current.initMatch({ 0: "p1" });
    });

    await step(() => {
      result.current.setMatchDuration(70);
    });
    await act(async () => {});

    expect(getFakeLiveMatchServer().state?.matchDurationMinutes).toBe(70);
  });

  it("se puede corregir después de finalizar", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await playAndEnd(result, 83 * 60 * 1000);

    await step(() => {
      result.current.setMatchDuration(70);
    });

    expect(result.current.matchDurationMinutes).toBe(70);
  });

  it("limita la duración editada a 0-200 minutos enteros", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await step(() => {
      result.current.setMatchDuration(250.4);
    });
    expect(result.current.matchDurationMinutes).toBe(200);

    await step(() => {
      result.current.setMatchDuration(-3);
    });
    expect(result.current.matchDurationMinutes).toBe(0);
  });

  it("restaura la duración guardada al volver a un partido terminado", async () => {
    vi.useRealTimers();
    vi.mocked(getMatchParticipation).mockResolvedValueOnce({
      teamId: TEAM_ID,
      scoreLocal: 1,
      scoreVisitor: 0,
      matchPhase: "finished",
      players: [],
      substitutionWindowsJson: "[]",
      ratingSnapshotsJson: "[]",
      goalsJson: "[]",
      cardsJson: "[]",
      formationChangesJson: "[]",
      matchDurationMinutes: 76,
    });

    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await waitForAsync(() => expect(result.current.matchDurationMinutes).toBe(76));
  });
});
