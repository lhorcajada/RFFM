import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../services/traitRatingService", () => ({
  getTeamLatestTraitRatings: vi.fn(),
}));

import { getTeamLatestTraitRatings } from "../../../../services/traitRatingService";
import { useLatestTraitRatings } from "../useLatestTraitRatings";

const mockGet = getTeamLatestTraitRatings as ReturnType<typeof vi.fn>;

const rating = { id: "r1", teamPlayerId: "p1", ratedAt: "2026-11-01T00:00:00", trend: "same", levels: [] };

describe("useLatestTraitRatings", () => {
  beforeEach(() => vi.resetAllMocks());

  it("carga las últimas valoraciones de rasgos del equipo", async () => {
    mockGet.mockResolvedValue([rating]);
    const { result } = renderHook(() => useLatestTraitRatings("t1"));

    await waitFor(() => expect(result.current).toEqual([rating]));
    expect(mockGet).toHaveBeenCalledWith("t1");
  });

  it("no llama al servidor si está desactivado o no hay equipo", () => {
    renderHook(() => useLatestTraitRatings("", true));
    renderHook(() => useLatestTraitRatings("t1", false));

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("devuelve una lista vacía si la lectura falla", async () => {
    mockGet.mockRejectedValue(new Error("403"));
    const { result } = renderHook(() => useLatestTraitRatings("t1"));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
