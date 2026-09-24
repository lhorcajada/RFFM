import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { getMatchParticipation, saveMatchParticipation } from "../../../../services/liveMatchService";

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

const EVENT_ID = "event-duration";
const TEAM_ID = "team-abc";

type Hook = { current: ReturnType<typeof useLiveMatch> };

function playAndEnd(result: Hook, playedMs: number) {
  act(() => {
    result.current.initMatch({ 0: "p1" });
  });
  act(() => {
    result.current.setPendingAction("startMatch");
  });
  act(() => {
    result.current.confirmAction();
  });
  act(() => {
    vi.advanceTimersByTime(playedMs);
  });
  act(() => {
    result.current.setPendingAction("endMatch");
  });
  act(() => {
    result.current.confirmAction();
  });
}

describe("useLiveMatch - duración del partido", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("al terminar rellena la duración con el minuto final del cronómetro", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    playAndEnd(result, 83 * 60 * 1000);

    expect(result.current.matchDurationMinutes).toBe(83);
  });

  it("sin cronómetro usa 2 × los minutos por parte configurados", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    act(() => {
      result.current.setHalfDuration(40);
    });

    playAndEnd(result, 5000);

    expect(result.current.matchDurationMinutes).toBe(80);
  });

  it("se puede corregir y se envía al guardar", async () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    playAndEnd(result, 83 * 60 * 1000);

    act(() => {
      result.current.setMatchDuration(70);
    });
    await act(async () => {
      result.current.confirmSave();
    });

    expect(saveMatchParticipation).toHaveBeenCalledWith(
      EVENT_ID,
      expect.objectContaining({ matchDurationMinutes: 70 }),
    );
  });

  it("limita la duración editada a 0-200 minutos enteros", () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    act(() => {
      result.current.setMatchDuration(250.4);
    });
    expect(result.current.matchDurationMinutes).toBe(200);

    act(() => {
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

    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await waitFor(() => expect(result.current.matchDurationMinutes).toBe(76));
  });
});
