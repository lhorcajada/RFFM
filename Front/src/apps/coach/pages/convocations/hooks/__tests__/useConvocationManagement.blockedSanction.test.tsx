import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useConvocationManagement } from "../useConvocationManagement";

const getConvocationStatusesMock = vi.fn();
vi.mock("../../../../services/convocationStatusService", () => ({
  default: { getConvocationStatuses: (...args: unknown[]) => getConvocationStatusesMock(...args) },
}));

const getExcuseTypesMock = vi.fn();
vi.mock("../../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: (...args: unknown[]) => getExcuseTypesMock(...args) },
}));

const getTeamLatestRatingsMock = vi.fn();
vi.mock("../../../../services/playerRatingService", () => ({
  default: { getTeamLatestRatings: (...args: unknown[]) => getTeamLatestRatingsMock(...args) },
}));

const fetchPlayerPhotoMock = vi.fn();
vi.mock("../../../../services/playerService", () => ({
  default: { fetchPlayerPhoto: (...args: unknown[]) => fetchPlayerPhotoMock(...args) },
}));

const getPlayersByTeamMock = vi.fn();
vi.mock("../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args) },
}));

const getSportEventsMock = vi.fn();
vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
}));

const getSportEventTypesMock = vi.fn();
vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: (...args: unknown[]) => getSportEventTypesMock(...args) },
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

const TEAM_ID = "team-1";
const MATCH_DATE = "2026-03-01T10:00:00.000Z";
const EVENT_ID = "event-1";
const PLAYER_ID = "player-blocked";

function buildPlayers() {
  return [
    { id: PLAYER_ID, name: "Juan", lastName: "Pérez", alias: "Juanito", isInjured: false },
  ];
}

function mockBlockedError() {
  return {
    response: { data: { detail: "El jugador está sancionado y no puede ser convocado." } },
  };
}

describe("useConvocationManagement — aviso de bloqueo por sanción al convocar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConvocationStatusesMock.mockResolvedValue([]);
    getExcuseTypesMock.mockResolvedValue([]);
    getTeamLatestRatingsMock.mockResolvedValue([]);
    fetchPlayerPhotoMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getSportEventTypesMock.mockResolvedValue([]);
    getSportEventsMock.mockResolvedValue({ items: [{ id: EVENT_ID, eventTypeId: 1, eventType: "Partido" }] });
    getConvocationsMock.mockResolvedValue([]);
    updateConvocationStatusMock.mockResolvedValue(undefined);
  });

  it("moveToNotCalled emite rffm.show_snackbar con el detalle del backend cuando addConvocation rechaza", async () => {
    addConvocationMock.mockRejectedValue(mockBlockedError());
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("rffm.show_snackbar", listener);

    const { result } = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));

    await waitFor(() => expect(result.current.mgmtEventId).toBe(EVENT_ID));
    await waitFor(() => expect(result.current.players.length).toBe(1));

    await act(async () => {
      await result.current.moveToNotCalled(PLAYER_ID, 1);
    });

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    expect(events[0].detail).toEqual(
      expect.objectContaining({
        message: "El jugador está sancionado y no puede ser convocado.",
        severity: "error",
      })
    );

    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("handleDrop emite rffm.show_snackbar cuando addConvocation rechaza al mover a 'called'", async () => {
    addConvocationMock.mockRejectedValue(mockBlockedError());
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("rffm.show_snackbar", listener);

    const { result } = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));

    await waitFor(() => expect(result.current.mgmtEventId).toBe(EVENT_ID));
    await waitFor(() => expect(result.current.players.length).toBe(1));
    await waitFor(() => expect(result.current.mgmtAvailable).toContain(PLAYER_ID));

    act(() => {
      result.current.handleDragStart(PLAYER_ID);
    });
    await act(async () => {
      await result.current.handleDrop("called");
    });

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    expect(events[0].detail).toEqual(
      expect.objectContaining({
        message: "El jugador está sancionado y no puede ser convocado.",
        severity: "error",
      })
    );

    window.removeEventListener("rffm.show_snackbar", listener);
  });

  it("handleSave emite rffm.show_snackbar cuando addConvocation rechaza para uno de los jugadores", async () => {
    addConvocationMock.mockRejectedValue(mockBlockedError());
    const events: CustomEvent[] = [];
    const listener = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("rffm.show_snackbar", listener);

    const { result } = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));

    await waitFor(() => expect(result.current.mgmtEventId).toBe(EVENT_ID));
    await waitFor(() => expect(result.current.players.length).toBe(1));
    await waitFor(() => expect(result.current.mgmtAvailable).toContain(PLAYER_ID));

    await act(async () => {
      await result.current.handleSave();
    });

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    expect(events[0].detail).toEqual(
      expect.objectContaining({
        message: "El jugador está sancionado y no puede ser convocado.",
        severity: "error",
      })
    );

    window.removeEventListener("rffm.show_snackbar", listener);
  });
});
