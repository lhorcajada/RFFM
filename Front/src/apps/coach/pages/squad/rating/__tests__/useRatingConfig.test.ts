import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRatingConfig = vi.hoisted(() => vi.fn());

vi.mock("../../../../services/ratingConfigService", () => ({ getRatingConfig }));

import { useRatingConfig } from "../useRatingConfig";
import { FIELD_PLAYER_CHARACTERISTICS } from "../ratingConcepts";
import { TRAIT_CATALOG } from "../ratingTraits";
import type { RatingConfig } from "../../../../types/ratingConfig";

const customConfig: RatingConfig = {
  capacities: [
    { key: "physicalSpeed", isCustom: false, isHidden: true, sheet: "field", categoryKey: "physical", label: null, levelTexts: null },
  ],
  traits: [
    { key: "custom-a", isCustom: true, isHidden: false, label: "Juego aéreo", phase: "withBall", anchor1: "x", anchor3: "y", anchor5: "z" },
    { key: "traitDuels", isCustom: false, isHidden: true, label: null, phase: null, anchor1: null, anchor3: null, anchor5: null },
  ],
};

describe("useRatingConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mientras carga devuelve el catálogo por defecto", () => {
    getRatingConfig.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRatingConfig("team-1"));

    expect(result.current.loading).toBe(true);
    expect(result.current.traits).toHaveLength(12);
    expect(result.current.visibleTraits).toHaveLength(12);
  });

  it("combina las personalizaciones del equipo con los valores por defecto", async () => {
    getRatingConfig.mockResolvedValue(customConfig);

    const { result } = renderHook(() => useRatingConfig("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getRatingConfig).toHaveBeenCalledWith("team-1");
    expect(result.current.traits).toHaveLength(13);
    expect(result.current.visibleTraits.map((t) => t.key)).toContain("custom-a");
    expect(result.current.visibleTraits.map((t) => t.key)).not.toContain("traitDuels");
    expect(result.current.capacities.field).toHaveLength(FIELD_PLAYER_CHARACTERISTICS.length);
    expect(result.current.visibleSheetCatalog.field).toHaveLength(FIELD_PLAYER_CHARACTERISTICS.length - 1);
  });

  it("usa los valores por defecto si la lectura falla", async () => {
    getRatingConfig.mockRejectedValue(new Error("403"));

    const { result } = renderHook(() => useRatingConfig("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.visibleTraits.map((t) => t.key)).toEqual(TRAIT_CATALOG.map((t) => t.key));
  });

  it("no consulta si no hay equipo", async () => {
    const { result } = renderHook(() => useRatingConfig(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getRatingConfig).not.toHaveBeenCalled();
    expect(result.current.visibleTraits).toHaveLength(12);
  });

  it("reload vuelve a leer la configuración", async () => {
    getRatingConfig.mockResolvedValueOnce({ capacities: [], traits: [] });
    const { result } = renderHook(() => useRatingConfig("team-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    getRatingConfig.mockResolvedValueOnce(customConfig);
    await act(async () => {
      await result.current.reload();
    });

    expect(getRatingConfig).toHaveBeenCalledTimes(2);
    expect(result.current.traits).toHaveLength(13);
  });
});
