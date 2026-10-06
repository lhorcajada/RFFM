import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../services/squadComparisonService", () => ({
  getCoachSquadComparison: vi.fn(),
}));

import { useCoachSquadComparison } from "../useCoachSquadComparison";
import { getCoachSquadComparison } from "../../../../services/squadComparisonService";

const getMock = vi.mocked(getCoachSquadComparison);

describe("useCoachSquadComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga la comparación del equipo seleccionado", async () => {
    const comparison = { isCoachTeam: true, teamId: "t1", teamName: "Infantil A", players: [] };
    getMock.mockResolvedValue(comparison);

    const { result } = renderHook(() => useCoachSquadComparison("555", "22", "100", "200"));

    await waitFor(() => expect(result.current.comparison).toEqual(comparison));
    expect(getMock).toHaveBeenCalledWith("555", "22", "100", "200");
  });

  it("no consulta nada si falta la competición o el grupo", () => {
    renderHook(() => useCoachSquadComparison("555", "22", undefined, "200"));

    expect(getMock).not.toHaveBeenCalled();
  });

  it("si la petición falla deja la comparación vacía", async () => {
    getMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useCoachSquadComparison("555", "22", "100", "200"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.comparison).toBeNull();
  });
});
