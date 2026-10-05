import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDesconvocatoriasGrid } from "../useDesconvocatoriasGrid";

const getConvocationsMock = vi.fn();
const getSportEventsMock = vi.fn();

vi.mock("../../../../services/convocationService", () => ({
  default: {
    getConvocations: (...args: unknown[]) => getConvocationsMock(...args),
    addConvocation: vi.fn(),
    updateConvocationStatus: vi.fn(),
  },
}));

vi.mock("../../../../services/convocationStatusService", () => ({
  default: { getConvocationStatuses: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../../services/excuseTypeService", () => ({
  default: { getExcuseTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../../services/sportEventTypeService", () => ({
  default: { getSportEventTypes: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../../services/teamplayerService", () => ({
  default: { getPlayersByTeam: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../../../../services/sportEventService", () => ({
  default: { getSportEvents: (...args: unknown[]) => getSportEventsMock(...args) },
}));

vi.mock("../../../../services/seasonService", () => ({
  default: {
    getActiveSeason: vi.fn().mockResolvedValue({ id: "season-1", startDate: "2026-07-01T00:00:00.000Z" }),
  },
}));

const leagueMatch = {
  id: "league-1",
  eventType: "Partido",
  start: "2026-09-20T10:00:00",
  rival: "Rival Liga",
};
const friendlyMatch = {
  id: "friendly-1",
  eventType: "Partido",
  title: "Partido amistoso",
  matchCategory: "Friendly",
  start: "2026-09-06T10:00:00",
  rival: "Rival Amistoso",
};

describe("useDesconvocatoriasGrid - partidos amistosos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConvocationsMock.mockResolvedValue([]);
    getSportEventsMock.mockResolvedValue({ items: [leagueMatch, friendlyMatch] });
  });

  it("incluye los partidos amistosos de la temporada activa en el cálculo de desconvocatorias", async () => {
    const { result } = renderHook(() => useDesconvocatoriasGrid("team-1", true));

    await waitFor(() => expect(result.current.matchColumns).toHaveLength(2));

    expect(result.current.matchColumns.map((c) => c.eventId)).toEqual(["league-1", "friendly-1"]);
    expect(getConvocationsMock).toHaveBeenCalledWith("friendly-1");
  });

  it("numera las jornadas solo con los partidos de liga y etiqueta los amistosos como tales", async () => {
    const { result } = renderHook(() => useDesconvocatoriasGrid("team-1", true));

    await waitFor(() => expect(result.current.matchColumns).toHaveLength(2));

    const [league, friendly] = result.current.matchColumns;
    expect(league.label).toMatch(/^J1 · /);
    expect(friendly.label).toMatch(/^Amist\. · /);
  });
});
