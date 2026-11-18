import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getTeamLatestTraitRatings = vi.hoisted(() => vi.fn());
const getRatingConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../services/traitRatingService", () => ({ getTeamLatestTraitRatings }));
vi.mock("../../../../services/ratingConfigService", () => ({ getRatingConfig }));

import { useConductData } from "../useConductData";

describe("useConductData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRatingConfig.mockResolvedValue({ capacities: [], traits: [] });
  });

  it("indexa por jugador la última valoración de conducta", async () => {
    getTeamLatestTraitRatings.mockResolvedValue([
      { id: "r1", teamPlayerId: "juan", ratedAt: "2026-11-02T00:00:00Z", trend: "up", levels: [{ traitKey: "traitPressing", level: 4 }] },
    ]);

    const { result } = renderHook(() => useConductData("team-1", true));

    await waitFor(() => expect(result.current.conductByPlayer.juan).toBeDefined());
    expect(result.current.conductByPlayer.juan.trend).toBe("up");
    expect(getTeamLatestTraitRatings).toHaveBeenCalledWith("team-1");
  });

  it("expone los rasgos visibles del equipo sin los ocultos", async () => {
    getTeamLatestTraitRatings.mockResolvedValue([]);
    getRatingConfig.mockResolvedValue({
      capacities: [],
      traits: [{ key: "traitPressing", isCustom: false, isHidden: true }],
    });

    const { result } = renderHook(() => useConductData("team-1", true));

    await waitFor(() => expect(result.current.traits.map((t) => t.key)).not.toContain("traitPressing"));
    expect(result.current.traits.map((t) => t.key)).toContain("traitDuels");
  });

  it("no pide nada cuando está desactivado", async () => {
    const { result } = renderHook(() => useConductData("team-1", false));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(getTeamLatestTraitRatings).not.toHaveBeenCalled();
    expect(getRatingConfig).not.toHaveBeenCalled();
    expect(result.current.conductByPlayer).toEqual({});
  });

  it("deja la pestaña usable si falla la lectura", async () => {
    getTeamLatestTraitRatings.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => useConductData("team-1", true));

    await waitFor(() => expect(getTeamLatestTraitRatings).toHaveBeenCalled());
    expect(result.current.conductByPlayer).toEqual({});
  });
});
