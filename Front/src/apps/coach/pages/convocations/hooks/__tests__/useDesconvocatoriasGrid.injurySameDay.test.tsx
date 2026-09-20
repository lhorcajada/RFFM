import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDesconvocatoriasGrid } from "../useDesconvocatoriasGrid";

const getConvocationsMock = vi.fn();
const addConvocationMock = vi.fn();
const updateConvocationStatusMock = vi.fn();
const getPlayersByTeamMock = vi.fn();
const getSportEventsMock = vi.fn();

vi.mock("../../../../services/convocationService", () => ({
  default: {
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: (...args: unknown[]) => addConvocationMock(...args),
    updateConvocationStatus: (...args: unknown[]) => updateConvocationStatusMock(...args),
  },
  getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
}));

vi.mock("../../../../services/convocationStatusService", () => {
  const statuses = [{ id: 3, name: "Deconvoke" }];
  return {
    default: { getConvocationStatuses: vi.fn().mockResolvedValue(statuses) },
    getConvocationStatuses: vi.fn().mockResolvedValue(statuses),
  };
});

vi.mock("../../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
  getExcuseTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Partido" }]) },
  getSportEventTypes: vi.fn().mockResolvedValue([{ id: 1, name: "Partido" }]),
}));

vi.mock("../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args) },
  getPlayersByTeam: (...args: unknown[]) => getPlayersByTeamMock(...args),
}));

vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
  getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
}));

vi.mock("../../../../services/seasonService", () => ({
  default: { getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", startDate: "2026-07-01T00:00:00.000Z" }) },
  getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", startDate: "2026-07-01T00:00:00.000Z" }),
}));

const MATCH_DAY = "2026-09-13";

function seedMatchAndPlayer(injuryStartDate: string) {
  getSportEventsMock.mockResolvedValue({
    items: [{ id: "match-1", eventTypeId: 1, eventType: "Partido", start: `${MATCH_DAY}T10:00:00`, name: "Rival" }],
  });
  getConvocationsMock.mockResolvedValue([]);
  getPlayersByTeamMock.mockResolvedValue([{ id: "p1", isInjured: true, injuryStartDate }]);
}

describe("useDesconvocatoriasGrid — lesión registrada el mismo día del partido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no desconvoca por lesión a un jugador cuya lesión empieza el mismo día del partido (se lesionó jugando)", async () => {
    seedMatchAndPlayer(`${MATCH_DAY}T20:00:00`);

    const { result } = renderHook(() => useDesconvocatoriasGrid("team-1", true));

    await waitFor(() => {
      expect(result.current.matchColumns).toHaveLength(1);
    });
    await waitFor(() => {
      expect(getPlayersByTeamMock).toHaveBeenCalled();
    });

    expect(addConvocationMock).not.toHaveBeenCalled();
    expect(updateConvocationStatusMock).not.toHaveBeenCalled();
  });

  it("sí desconvoca por lesión a un jugador cuya lesión empezó antes del día del partido", async () => {
    seedMatchAndPlayer("2026-09-10T09:00:00");
    addConvocationMock.mockResolvedValue(undefined);
    getConvocationsMock
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: "conv-1", player: { id: "p1" } }]);
    updateConvocationStatusMock.mockResolvedValue(undefined);

    renderHook(() => useDesconvocatoriasGrid("team-1", true));

    await waitFor(() => {
      expect(updateConvocationStatusMock).toHaveBeenCalledWith("match-1", "conv-1", 3, 1);
    });
    expect(addConvocationMock).toHaveBeenCalledWith("match-1", "p1");
  });
});
