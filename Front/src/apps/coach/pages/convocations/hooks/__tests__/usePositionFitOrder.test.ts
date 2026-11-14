import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../../../../services/positionFitService", () => ({
  getTeamPositionFit: vi.fn(),
}));

import { getTeamPositionFit } from "../../../../services/positionFitService";
import { usePositionFitOrder } from "../usePositionFitOrder";
import type { PositionFit } from "../../../../types/positionFit";

const mockGet = getTeamPositionFit as ReturnType<typeof vi.fn>;

const data: PositionFit[] = [
  {
    position: "midfielder",
    confirmedWeekStart: null,
    isManual: false,
    candidates: [{ teamPlayerId: "a", name: "A", place: 1, fit: 4, trend: "same" }],
    weights: {},
  },
];

describe("usePositionFitOrder", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("no tiene orden mientras carga", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => usePositionFitOrder("t1"));

    expect(result.current).toEqual([]);
  });

  it("devuelve el encaje de los puestos del equipo", async () => {
    mockGet.mockResolvedValue(data);

    const { result } = renderHook(() => usePositionFitOrder("t1"));

    await waitFor(() => expect(result.current).toEqual(data));
    expect(mockGet).toHaveBeenCalledWith("t1");
  });

  it("no tiene orden si la lectura falla (por ejemplo, sin permiso)", async () => {
    mockGet.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => usePositionFitOrder("t1"));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it("no consulta si no hay equipo", () => {
    renderHook(() => usePositionFitOrder(""));

    expect(mockGet).not.toHaveBeenCalled();
  });
});
