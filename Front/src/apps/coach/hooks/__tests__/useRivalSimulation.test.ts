import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRivalSimulationMock = vi.fn();
const getRivalSimulationHistoryMock = vi.fn();
const syncRivalSimulationRoundsMock = vi.fn();
vi.mock("../../services/rivalStatsService", () => ({
  getRivalSimulation: (...args: unknown[]) => getRivalSimulationMock(...args),
  getRivalSimulationHistory: (...args: unknown[]) => getRivalSimulationHistoryMock(...args),
  syncRivalSimulationRounds: (...args: unknown[]) => syncRivalSimulationRoundsMock(...args),
}));

import useRivalSimulation from "../useRivalSimulation";

const simulation = { playedMatches: 4, pendingMatches: 8, usesSquadStrength: true, ownTeamCode: "E1", iterations: 10000, matches: [], standings: [] };
const history = { ownTeamCode: "E1", totalHits: 3, totalEvaluated: 4, rounds: [] };

describe("useRivalSimulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRivalSimulationMock.mockResolvedValue(simulation);
    getRivalSimulationHistoryMock.mockResolvedValue(history);
    syncRivalSimulationRoundsMock.mockResolvedValue(undefined);
  });

  it("carga la simulación actual y el historial tras sincronizar las jornadas", async () => {
    const order: string[] = [];
    syncRivalSimulationRoundsMock.mockImplementation(async () => { order.push("sync"); });
    getRivalSimulationHistoryMock.mockImplementation(async () => { order.push("history"); return history; });

    const { result } = renderHook(() => useRivalSimulation("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.simulation).toEqual(simulation);
    expect(result.current.history).toEqual(history);
    expect(order).toEqual(["sync", "history"]);
  });

  it("si falla la sincronización pide igualmente el historial guardado", async () => {
    syncRivalSimulationRoundsMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRivalSimulation("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toEqual(history);
  });

  it("si falla el historial sigue mostrando la simulación actual", async () => {
    getRivalSimulationHistoryMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRivalSimulation("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.history).toBeNull();
    expect(result.current.simulation).toEqual(simulation);
    expect(result.current.error).toBe(false);
  });

  it("si falla la simulación actual marca el error", async () => {
    getRivalSimulationMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRivalSimulation("team-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });

  it("sin equipo no pide nada", () => {
    const { result } = renderHook(() => useRivalSimulation(undefined));

    expect(result.current.loading).toBe(false);
    expect(getRivalSimulationMock).not.toHaveBeenCalled();
    expect(syncRivalSimulationRoundsMock).not.toHaveBeenCalled();
  });
});
