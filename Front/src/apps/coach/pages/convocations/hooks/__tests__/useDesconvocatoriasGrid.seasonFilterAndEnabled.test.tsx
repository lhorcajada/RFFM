import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDesconvocatoriasGrid } from "../useDesconvocatoriasGrid";

const getConvocationsMock = vi.fn();
const getSportEventsMock = vi.fn();
const getActiveSeasonMock = vi.fn();

vi.mock("../../../../services/convocationService", () => ({
  default: {
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: vi.fn(),
    updateConvocationStatus: vi.fn(),
  },
  getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
}));

vi.mock("../../../../services/convocationStatusService", () => ({
  default: { getConvocationStatuses: vi.fn().mockResolvedValue([]) },
  getConvocationStatuses: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
  getExcuseTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
  getSportEventTypes: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
  getPlayersByTeam: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
  getSportEvents: (...args: unknown[]) => getSportEventsMock(...args),
}));

vi.mock("../../../../services/seasonService", () => ({
  default: { getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args) },
  getActiveSeason: (...args: unknown[]) => getActiveSeasonMock(...args),
}));

describe("useDesconvocatoriasGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSportEventsMock.mockResolvedValue({ items: [] });
    getActiveSeasonMock.mockResolvedValue({
      id: "season-1",
      startDate: "2026-07-01T00:00:00.000Z",
    });
  });

  it("no pide partidos ni convocatorias cuando enabled es false", async () => {
    renderHook(() => useDesconvocatoriasGrid("team-1", false));

    await waitFor(() => {
      expect(getSportEventsMock).not.toHaveBeenCalled();
      expect(getConvocationsMock).not.toHaveBeenCalled();
    });
  });

  it("filtra los partidos históricos por la fecha de inicio de la temporada activa", async () => {
    renderHook(() => useDesconvocatoriasGrid("team-1", true));

    await waitFor(() => {
      expect(getSportEventsMock).toHaveBeenCalled();
    });

    const [, , , startDateArg] = getSportEventsMock.mock.calls[0];
    expect(startDateArg).toBe("2026-07-01T00:00:00.000Z");
  });
});
