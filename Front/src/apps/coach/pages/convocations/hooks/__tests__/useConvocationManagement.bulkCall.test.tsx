import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useConvocationManagement } from "../useConvocationManagement";

vi.mock("../../../../services/convocationStatusService", () => ({
  default: { getConvocationStatuses: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: vi.fn().mockResolvedValue([{ id: 3, name: "Enfermedad" }]) },
}));
vi.mock("../../../../services/playerRatingService", () => ({
  default: { getTeamLatestRatings: vi.fn().mockResolvedValue([]) },
}));
vi.mock("../../../../services/playerService", () => ({
  default: { fetchPlayerPhoto: vi.fn().mockResolvedValue(null) },
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args) },
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
}));
vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
}));

const getConvocationsMock = vi.fn();
const addConvocationMock = vi.fn();
const updateConvocationStatusMock = vi.fn();
vi.mock("../../../../services/convocationService", () => ({
  default: {
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: (...args: unknown[]) => addConvocationMock(...args),
    updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
  },
}));

vi.mock("../../../../services/availabilityService", () => ({
  default: { getAvailabilityRequests: vi.fn().mockResolvedValue([]) },
}));

const TEAM_ID = "team-1";
const MATCH_DATE = "2026-03-01T10:00:00.000Z";
const EVENT_ID = "event-1";

const PLAYERS = [
  { id: "p-a", name: "Ana", isInjured: false },
  { id: "p-b", name: "Bea", isInjured: false },
  { id: "p-c", name: "Carla", isInjured: false },
  { id: "p-called", name: "Convocada", isInjured: false },
];

async function renderLoaded() {
  getPlayersByTeamMock.mockResolvedValue(PLAYERS);
  getSportEventsMock.mockResolvedValue({ items: [{ id: EVENT_ID, eventTypeId: 1, eventType: "Partido", matchCategory: "Friendly" }] });
  getConvocationsMock.mockResolvedValue([{ id: "conv-1", player: { id: "p-called" }, status: 2 }]);
  updateConvocationStatusMock.mockResolvedValue(undefined);
  const hook = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));
  await waitFor(() => expect(hook.result.current.mgmtAvailable).toEqual(["p-a", "p-b", "p-c"]));
  return hook;
}

describe("useConvocationManagement — convocar varios disponibles a la vez", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("convoca todos los jugadores indicados y los pasa a convocados", async () => {
    addConvocationMock.mockImplementation(async (_eventId: string, pid: string) => ({ id: `conv-${pid}` }));
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.handleCallPlayers(["p-a", "p-b"]);
    });

    expect(addConvocationMock).toHaveBeenCalledWith(EVENT_ID, "p-a");
    expect(addConvocationMock).toHaveBeenCalledWith(EVENT_ID, "p-b");
    expect(result.current.mgmtCalled).toEqual(expect.arrayContaining(["p-called", "p-a", "p-b"]));
    expect(result.current.mgmtAvailable).toEqual(["p-c"]);
  });

  it("si falla la convocatoria de un jugador, solo ese vuelve a disponibles", async () => {
    addConvocationMock.mockImplementation(async (_eventId: string, pid: string) => {
      if (pid === "p-b") throw new Error("boom");
      return { id: `conv-${pid}` };
    });
    const { result } = await renderLoaded();

    await act(async () => {
      await result.current.handleCallPlayers(["p-a", "p-b"]);
    });

    expect(result.current.mgmtCalled).toContain("p-a");
    expect(result.current.mgmtCalled).not.toContain("p-b");
    expect(result.current.mgmtAvailable).toEqual(expect.arrayContaining(["p-b", "p-c"]));
  });
});
