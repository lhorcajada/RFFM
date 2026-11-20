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
const deleteConvocationMock = vi.fn();
vi.mock("../../../../services/convocationService", () => ({
  default: {
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: (...args: unknown[]) => addConvocationMock(...args),
    updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
    deleteConvocation: (...args: unknown[]) => deleteConvocationMock(...args),
  },
}));

const getAvailabilityRequestsMock = vi.fn();
vi.mock("../../../../services/availabilityService", () => ({
  default: {
    getAvailabilityRequests: (...args: unknown[]) => getAvailabilityRequestsMock(...args),
    respondAvailability: vi.fn(),
    decideAvailable: vi.fn(),
  },
}));

const TEAM_ID = "team-1";
const MATCH_DATE = "2026-03-01T10:00:00.000Z";
const EVENT_ID = "event-1";

const PLAYERS = [
  { id: "p-called", name: "Convocado", isInjured: false },
  { id: "p-wait", name: "Espera", isInjured: false },
];

async function setup() {
  getPlayersByTeamMock.mockResolvedValue(PLAYERS);
  getSportEventsMock.mockResolvedValue({
    items: [{ id: EVENT_ID, eventTypeId: 1, eventType: "Partido", matchCategory: "League" }],
  });
  getConvocationsMock.mockResolvedValue([{ id: "conv-1", player: { id: "p-called" }, status: 2 }]);
  getAvailabilityRequestsMock.mockResolvedValue([
    { id: "req-1", teamPlayerId: "p-called", status: "Available", requestedAt: "2026-02-25T10:00:00Z", respondedAt: "2026-02-25T11:00:00Z" },
  ]);
  const view = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));
  await waitFor(() => expect(view.result.current.mgmtCalled).toContain("p-called"));
  return view;
}

describe("useConvocationManagement — pasar un convocado a la lista de espera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteConvocationMock.mockResolvedValue(undefined);
  });

  it("borra la convocatoria del jugador y lo mueve de Convocados a la lista de espera", async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.moveToWaiting("p-called");
    });

    expect(deleteConvocationMock).toHaveBeenCalledWith(EVENT_ID, "conv-1");
    expect(result.current.mgmtCalled).not.toContain("p-called");
    expect(result.current.mgmtWaiting).toContain("p-called");
  });

  it("si el borrado falla, el jugador vuelve a Convocados y se avisa del error", async () => {
    deleteConvocationMock.mockRejectedValue(new Error("boom"));
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("rffm.show_snackbar", listener);
    const { result } = await setup();

    await act(async () => {
      await result.current.moveToWaiting("p-called");
    });

    expect(result.current.mgmtCalled).toContain("p-called");
    expect(result.current.mgmtWaiting).not.toContain("p-called");
    expect(events[0]?.detail).toEqual(expect.objectContaining({ severity: "error" }));
    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("no hace nada con un jugador que no está convocado", async () => {
    const { result } = await setup();

    await act(async () => {
      await result.current.moveToWaiting("p-wait");
    });

    expect(deleteConvocationMock).not.toHaveBeenCalled();
  });
});
