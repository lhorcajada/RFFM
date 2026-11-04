import { step, renderSettledHook } from "./fakeLiveMatchServer";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLiveMatch } from "../useLiveMatch";
import { saveMatchParticipation } from "../../../../services/liveMatchService";
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
    getEventMinuteLimitSanctions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../../../../services/liveMatchRealtimeService", async () => {
  const fake = await import("./fakeLiveMatchServer");
  return fake.liveMatchRealtimeMocks();
});

const EVENT_ID = "event-123";
const TEAM_ID = "team-abc";

type Hook = { current: ReturnType<typeof useLiveMatch> };

async function playAndEndMatch(result: Hook) {
  await step(() => {
    result.current.initMatch({ 0: "p0", 1: "p1" }, { id: "f1", name: "4-4-2" });
  });
  await step(() => {
    result.current.setPendingAction("startMatch");
  });
  await step(() => {
    result.current.confirmAction();
  });
  await step(() => {
    result.current.addGoal("p1", "P1", 9, true);
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

describe("useLiveMatch - cierre del partido en el servidor", () => {
  beforeEach(() => {
    localStorage.clear();
    resetFakeLiveMatchServer({ eventId: EVENT_ID });
    vi.mocked(saveMatchParticipation).mockReset();
    vi.mocked(saveMatchParticipation).mockResolvedValue(undefined);
  });

  it("cierra el partido en el servidor una sola vez con el marcador final y los jugadores", async () => {
    const server = getFakeLiveMatchServer();
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await playAndEndMatch(result);

    await waitFor(() => expect(result.current.hasSavedData).toBe(true));
    expect(server.finishLiveMatch).toHaveBeenCalledTimes(1);
    const [eventId, , players] = server.finishLiveMatch.mock.calls[0];
    expect(eventId).toBe(EVENT_ID);
    expect(players.map((p: { teamPlayerId: string }) => p.teamPlayerId).sort()).toEqual(["p0", "p1"]);
    expect(server.state?.scoreLocal).toBe(1);
  });

  it("no envía la participación final con saveMatchParticipation cuando el partido tiene estado en el servidor", async () => {
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await playAndEndMatch(result);

    await waitFor(() => expect(result.current.hasSavedData).toBe(true));
    expect(saveMatchParticipation).not.toHaveBeenCalled();
  });

  it("si el cierre falla en el servidor, muestra el error y no marca el partido como guardado", async () => {
    const server = getFakeLiveMatchServer();
    server.finishLiveMatch.mockRejectedValueOnce(new Error("network"));
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));

    await playAndEndMatch(result);

    await waitFor(() => expect(result.current.saveError).not.toBeNull());
    expect(result.current.hasSavedData).toBe(false);
  });

  it("reintentar tras un fallo vuelve a enviar el cierre al servidor", async () => {
    const server = getFakeLiveMatchServer();
    server.finishLiveMatch.mockRejectedValueOnce(new Error("network"));
    const { result } = await renderSettledHook(() => useLiveMatch(EVENT_ID, TEAM_ID, true));
    await playAndEndMatch(result);
    await waitFor(() => expect(result.current.saveError).not.toBeNull());

    await step(() => {
      result.current.retrySave();
    });

    await waitFor(() => expect(result.current.hasSavedData).toBe(true));
    expect(server.finishLiveMatch).toHaveBeenCalledTimes(2);
  });
});
