import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { saveMatchParticipation } from "../../../../services/liveMatchService";

vi.mock("../../../../services/liveMatchService", async () => {
  const actual = await vi.importActual<typeof import("../../../../services/liveMatchService")>(
    "../../../../services/liveMatchService",
  );
  return {
    ...actual,
    saveMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getMatchParticipation: vi.fn().mockResolvedValue(null),
    deleteMatchParticipation: vi.fn().mockResolvedValue(undefined),
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";

type Hook = { current: ReturnType<typeof useLiveMatch> };

function playAndEndMatch(result: Hook) {
  act(() => {
    result.current.initMatch({ 0: "p0", 1: "p1" }, { id: "f1", name: "4-4-2" });
  });
  act(() => {
    result.current.setPendingAction("startMatch");
  });
  act(() => {
    result.current.confirmAction();
  });
  act(() => {
    result.current.addGoal("p1", "P1", 9, true);
  });
  act(() => {
    result.current.setPendingAction("endMatch");
  });
  act(() => {
    result.current.confirmAction();
  });
}

describe("useLiveMatch - guardado automático al finalizar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(saveMatchParticipation).mockReset();
    vi.mocked(saveMatchParticipation).mockResolvedValue(undefined);
  });

  it("guarda el partido una sola vez al finalizarlo, con el marcador final", async () => {
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    playAndEndMatch(result);

    await waitFor(() => expect(result.current.hasSavedData).toBe(true));
    expect(saveMatchParticipation).toHaveBeenCalledTimes(1);
    const [eventId, payload] = vi.mocked(saveMatchParticipation).mock.calls[0];
    expect(eventId).toBe(EVENT_ID);
    expect(payload.matchPhase).toBe("finished");
    expect(payload.scoreLocal).toBe(1);
    expect(payload.players.map((p) => p.teamPlayerId).sort()).toEqual(["p0", "p1"]);
  });

  it("si el guardado falla, muestra el error y no marca el partido como guardado", async () => {
    vi.mocked(saveMatchParticipation).mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    playAndEndMatch(result);

    await waitFor(() => expect(result.current.saveError).not.toBeNull());
    expect(result.current.hasSavedData).toBe(false);
  });

  it("reintentar tras un fallo guarda el partido", async () => {
    vi.mocked(saveMatchParticipation).mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    playAndEndMatch(result);
    await waitFor(() => expect(result.current.saveError).not.toBeNull());

    act(() => {
      result.current.retrySave();
    });

    await waitFor(() => expect(result.current.hasSavedData).toBe(true));
    expect(saveMatchParticipation).toHaveBeenCalledTimes(2);
  });
});
