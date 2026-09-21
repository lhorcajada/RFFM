import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let mockSeasonId: number | null = null;
let mockChangeToken = 0;

vi.mock("../../context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({
    seasonId: mockSeasonId,
    seasonChangeToken: mockChangeToken,
    seasons: [],
    setSeasonId: vi.fn(),
    applySeasonId: vi.fn(),
  }),
}));

import useClearOnSeasonChange from "../useClearOnSeasonChange";

describe("useClearOnSeasonChange", () => {
  beforeEach(() => {
    mockSeasonId = 21;
    mockChangeToken = 0;
  });

  it("no limpia en el primer render", () => {
    const onClear = vi.fn();
    renderHook(() => useClearOnSeasonChange(onClear));
    expect(onClear).not.toHaveBeenCalled();
  });

  it("limpia cuando el usuario cambia de temporada", () => {
    const onClear = vi.fn();
    const { rerender } = renderHook(() => useClearOnSeasonChange(onClear));
    mockSeasonId = 20;
    mockChangeToken = 1;
    rerender();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("no limpia cuando la temporada se aplica desde la configuración guardada", () => {
    const onClear = vi.fn();
    const { rerender } = renderHook(() => useClearOnSeasonChange(onClear));
    mockSeasonId = 20;
    rerender();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("no vuelve a limpiar si no hay un nuevo cambio del usuario", () => {
    const onClear = vi.fn();
    const { rerender } = renderHook(() => useClearOnSeasonChange(onClear));
    mockChangeToken = 1;
    rerender();
    rerender();
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
