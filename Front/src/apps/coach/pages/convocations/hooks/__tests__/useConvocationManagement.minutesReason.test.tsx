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
const updateConvocationMinutesReasonMock = vi.fn();
vi.mock("../../../../services/convocationService", () => ({
  default: {
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: (...args: unknown[]) => addConvocationMock(...args),
    updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
    updateConvocationMinutesReason: (...args: unknown[]) => updateConvocationMinutesReasonMock(...args),
  },
}));

const TEAM_ID = "team-1";
const MATCH_DATE = "2026-03-01T10:00:00.000Z";
const EVENT_ID = "event-1";
const PLAYER_ID = "player-1";
const CONVOCATION_ID = "conv-1";

function buildPlayers() {
  return [{ id: PLAYER_ID, name: "Juan", lastName: "Pérez", alias: "Juanito", isInjured: false }];
}

describe("useConvocationManagement — motivo de minutos (pre-partido)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConvocationStatusesMock.mockResolvedValue([]);
    getExcuseTypesMock.mockResolvedValue([]);
    getTeamLatestRatingsMock.mockResolvedValue([]);
    fetchPlayerPhotoMock.mockResolvedValue(null);
    getPlayersByTeamMock.mockResolvedValue(buildPlayers());
    getSportEventTypesMock.mockResolvedValue([]);
    getSportEventsMock.mockResolvedValue({ items: [{ id: EVENT_ID, eventTypeId: 1, eventType: "Partido" }] });
    getConvocationsMock.mockResolvedValue([
      {
        id: CONVOCATION_ID,
        player: { id: PLAYER_ID },
        status: 2,
        minutesReason: "Vuelta de vacaciones",
      },
    ]);
    updateConvocationStatusMock.mockResolvedValue(undefined);
    updateConvocationMinutesReasonMock.mockResolvedValue(undefined);
  });

  it("carga el motivo ya guardado en mgmtMinutesReasonMap al obtener las convocatorias", async () => {
    const { result } = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));

    await waitFor(() =>
      expect(result.current.mgmtMinutesReasonMap[PLAYER_ID]).toBe("Vuelta de vacaciones"),
    );
  });

  it("saveMinutesReason llama al servicio con el convocationId del jugador y actualiza el estado local", async () => {
    const { result } = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));

    await waitFor(() => expect(result.current.mgmtConvMap[PLAYER_ID]).toBe(CONVOCATION_ID));

    await act(async () => {
      await result.current.saveMinutesReason(PLAYER_ID, "Molestias musculares leves");
    });

    expect(updateConvocationMinutesReasonMock).toHaveBeenCalledWith(
      EVENT_ID,
      CONVOCATION_ID,
      "Molestias musculares leves",
    );
    expect(result.current.mgmtMinutesReasonMap[PLAYER_ID]).toBe("Molestias musculares leves");
  });

  it("saveMinutesReason con null borra el motivo guardado", async () => {
    const { result } = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));

    await waitFor(() => expect(result.current.mgmtConvMap[PLAYER_ID]).toBe(CONVOCATION_ID));

    await act(async () => {
      await result.current.saveMinutesReason(PLAYER_ID, null);
    });

    expect(updateConvocationMinutesReasonMock).toHaveBeenCalledWith(EVENT_ID, CONVOCATION_ID, null);
    expect(result.current.mgmtMinutesReasonMap[PLAYER_ID]).toBeNull();
  });

  it("saveMinutesReason no bloquea nada — no forma parte de handleSave (guardar convocatoria)", async () => {
    const { result } = renderHook(() => useConvocationManagement(TEAM_ID, MATCH_DATE));

    await waitFor(() => expect(result.current.mgmtConvMap[PLAYER_ID]).toBe(CONVOCATION_ID));

    await act(async () => {
      await result.current.handleSave();
    });

    expect(updateConvocationMinutesReasonMock).not.toHaveBeenCalled();
    expect(result.current.mgmtSaveResult).toBe("success");
  });
});
