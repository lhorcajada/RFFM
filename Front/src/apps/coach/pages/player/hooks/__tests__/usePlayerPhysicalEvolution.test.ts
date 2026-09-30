import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getPlayerPhysicalEvolutionMock = vi.fn();
vi.mock("../../../../services/teamPlayerStatisticsService", () => ({
  getPlayerPhysicalEvolution: (...args: unknown[]) => getPlayerPhysicalEvolutionMock(...args),
}));

import { usePlayerPhysicalEvolution } from "../usePlayerPhysicalEvolution";

const EVOLUTION = {
  teamPlayerId: "tp-1",
  days: 28,
  formStatusAvailable: true,
  points: [{ date: "2026-09-30T00:00:00Z", formStatus: 62, readiness: 70, fatigue: 35 }],
  events: [],
  injuries: [],
};

describe("usePlayerPhysicalEvolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no llama al servicio sin teamId o sin teamPlayerId", () => {
    renderHook(() => usePlayerPhysicalEvolution(undefined, "tp-1"));
    renderHook(() => usePlayerPhysicalEvolution("team-1", undefined));

    expect(getPlayerPhysicalEvolutionMock).not.toHaveBeenCalled();
  });

  it("carga por defecto las últimas 4 semanas", async () => {
    getPlayerPhysicalEvolutionMock.mockResolvedValue(EVOLUTION);

    const { result } = renderHook(() => usePlayerPhysicalEvolution("team-1", "tp-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getPlayerPhysicalEvolutionMock).toHaveBeenCalledWith("team-1", "tp-1", 28);
    expect(result.current.data).toEqual(EVOLUTION);
    expect(result.current.error).toBe(false);
  });

  it("vuelve a pedir la evolución al cambiar el rango", async () => {
    getPlayerPhysicalEvolutionMock.mockResolvedValue(EVOLUTION);
    const { result } = renderHook(() => usePlayerPhysicalEvolution("team-1", "tp-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setDays(56));

    await waitFor(() => expect(getPlayerPhysicalEvolutionMock).toHaveBeenLastCalledWith("team-1", "tp-1", 56));
    expect(result.current.days).toBe(56);
  });

  it("marca el error si falla y permite reintentar", async () => {
    getPlayerPhysicalEvolutionMock.mockRejectedValueOnce(new Error("network error"));
    const { result } = renderHook(() => usePlayerPhysicalEvolution("team-1", "tp-1"));
    await waitFor(() => expect(result.current.error).toBe(true));

    getPlayerPhysicalEvolutionMock.mockResolvedValue(EVOLUTION);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.data).toEqual(EVOLUTION));
    expect(result.current.error).toBe(false);
    expect(getPlayerPhysicalEvolutionMock).toHaveBeenCalledTimes(2);
  });
});
