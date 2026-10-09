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

const getAvailabilityRequestsMock = vi.fn();
vi.mock("../../../../services/availabilityService", () => ({
  default: { getAvailabilityRequests: (...args: unknown[]) => getAvailabilityRequestsMock(...args) },
}));

const TEAM_ID = "team-1";
const MATCH_DATE = "2026-03-01T10:00:00.000Z";
const EVENT_ID = "event-1";

const PLAYERS = [
  { id: "p-wait", name: "Espera", isInjured: false },
  { id: "p-req", name: "Pendiente", isInjured: false },
  { id: "p-av", name: "Disponible", isInjured: false },
  { id: "p-called", name: "Convocado", isInjured: false },
  { id: "p-injured", name: "Lesionado", isInjured: true, injuryStartDate: "2026-02-01" },
];

const REQUESTS = [
  { id: "req-1", teamPlayerId: "p-req", status: "Requested", requestedAt: "2026-02-25T10:00:00Z", respondedAt: null },
  { id: "req-2", teamPlayerId: "p-av", status: "Available", requestedAt: "2026-02-25T10:00:00Z", respondedAt: "2026-02-25T11:00:00Z" },
  { id: "req-3", teamPlayerId: "p-called", status: "Available", requestedAt: "2026-02-25T10:00:00Z", respondedAt: "2026-02-25T11:00:00Z" },
];

function setup(matchCategory: "League" | "Friendly") {
  getPlayersByTeamMock.mockResolvedValue(PLAYERS);
  getSportEventsMock.mockResolvedValue({ items: [{ id: EVENT_ID, eventTypeId: 1, eventType: "Partido", matchCategory }] });
  getConvocationsMock.mockResolvedValue([{ id: "conv-1", player: { id: "p-called" }, status: 2 }]);
  getAvailabilityRequestsMock.mockResolvedValue(REQUESTS);
  addConvocationMock.mockResolvedValue({ id: "conv-new" });
  updateConvocationStatusMock.mockResolvedValue(undefined);
}

async function renderLoaded() {
  const hook = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));
  await waitFor(() => expect(hook.result.current.mgmtCalled).toEqual(["p-called"]));
  return hook;
}

describe("useConvocationManagement — disponibilidad en partidos de liga", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("en liga reparte a los jugadores sin convocatoria entre espera, pendientes de respuesta y disponibles", async () => {
    setup("League");
    const { result } = await renderLoaded();

    await waitFor(() => expect(result.current.mgmtIsLeagueMatch).toBe(true));
    expect(result.current.mgmtWaiting).toEqual(["p-wait"]);
    expect(result.current.mgmtAvailabilityPending).toEqual(["p-req"]);
    expect(result.current.mgmtAvailable).toEqual(["p-av"]);
    expect(result.current.mgmtNotCalled).toEqual(["p-injured"]);
  });

  it("en un amistoso todos los jugadores sin convocatoria siguen siendo disponibles y no se consulta la disponibilidad", async () => {
    setup("Friendly");
    const { result } = await renderLoaded();

    expect(result.current.mgmtIsLeagueMatch).toBe(false);
    expect(result.current.mgmtAvailable).toEqual(["p-wait", "p-req", "p-av"]);
    expect(result.current.mgmtWaiting).toEqual([]);
    expect(result.current.mgmtAvailabilityPending).toEqual([]);
    expect(getAvailabilityRequestsMock).not.toHaveBeenCalled();
  });

  it("en liga arrastrar un disponible a convocados lo convoca", async () => {
    setup("League");
    const { result } = await renderLoaded();
    await waitFor(() => expect(result.current.mgmtAvailable).toEqual(["p-av"]));

    act(() => result.current.handleDragStart("p-av"));
    await act(async () => {
      await result.current.handleDrop("called");
    });

    expect(addConvocationMock).toHaveBeenCalledWith(EVENT_ID, "p-av");
    expect(result.current.mgmtCalled).toContain("p-av");
    expect(result.current.mgmtAvailable).not.toContain("p-av");
  });

  it("en liga no se puede soltar un jugador en disponibles", async () => {
    setup("League");
    const { result } = await renderLoaded();
    await waitFor(() => expect(result.current.mgmtWaiting).toEqual(["p-wait"]));

    act(() => result.current.handleDragStart("p-wait"));
    await act(async () => {
      await result.current.handleDrop("available");
    });

    expect(result.current.mgmtWaiting).toEqual(["p-wait"]);
    expect(result.current.mgmtAvailable).toEqual(["p-av"]);
    expect(addConvocationMock).not.toHaveBeenCalled();
  });
});
