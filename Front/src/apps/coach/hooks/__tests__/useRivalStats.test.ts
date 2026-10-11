import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/rivalStatsService", () => ({
  getRivalStats: vi.fn(),
  requestRivalStats: vi.fn(),
}));

import useRivalStats from "../useRivalStats";
import { getRivalStats, requestRivalStats, type RivalStats } from "../../services/rivalStatsService";

const POLL_MS = 20;

function stats(overrides: Partial<RivalStats> = {}): RivalStats {
  return {
    status: "Completed",
    totalPlayers: 2,
    processedPlayers: 2,
    failedPlayers: 0,
    completedAt: "2026-10-12T08:00:00Z",
    nextRefreshAllowedAt: null,
    errorMessage: null,
    ownTeamCode: null,
    teams: [],
    ...overrides,
  };
}

describe("useRivalStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sin informe generado devuelve stats nulo y deja de cargar", async () => {
    vi.mocked(getRivalStats).mockResolvedValue(null);

    const { result } = renderHook(() => useRivalStats("team-1", POLL_MS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toBeNull();
    expect(getRivalStats).toHaveBeenCalledWith("team-1");
  });

  it("no consulta nada mientras no haya equipo", async () => {
    const { result } = renderHook(() => useRivalStats(undefined, POLL_MS));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getRivalStats).not.toHaveBeenCalled();
  });

  it("mientras el informe está en curso vuelve a consultar hasta que termina", async () => {
    vi.mocked(getRivalStats)
      .mockResolvedValueOnce(stats({ status: "Running", processedPlayers: 1 }))
      .mockResolvedValueOnce(stats({ status: "Running", processedPlayers: 2 }))
      .mockResolvedValue(stats({ status: "Completed" }));

    const { result } = renderHook(() => useRivalStats("team-1", POLL_MS));

    await waitFor(() => expect(result.current.stats?.status).toBe("Completed"));
    expect(getRivalStats).toHaveBeenCalledTimes(3);
  });

  it("con el informe completado no sigue consultando", async () => {
    vi.mocked(getRivalStats).mockResolvedValue(stats());

    const { result } = renderHook(() => useRivalStats("team-1", POLL_MS));

    await waitFor(() => expect(result.current.stats?.status).toBe("Completed"));
    await new Promise((resolve) => setTimeout(resolve, POLL_MS * 4));
    expect(getRivalStats).toHaveBeenCalledTimes(1);
  });

  it("generate pide las estadísticas sin actualizar y recarga el estado", async () => {
    vi.mocked(getRivalStats).mockResolvedValueOnce(null).mockResolvedValue(stats({ status: "Pending" }));
    vi.mocked(requestRivalStats).mockResolvedValue(stats({ status: "Pending" }));
    const { result } = renderHook(() => useRivalStats("team-1", 60_000));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.generate();
    });

    expect(requestRivalStats).toHaveBeenCalledWith("team-1", false);
    expect(result.current.stats?.status).toBe("Pending");
  });

  it("refresh pide actualizar las estadísticas", async () => {
    vi.mocked(getRivalStats).mockResolvedValue(stats());
    vi.mocked(requestRivalStats).mockResolvedValue(stats({ status: "Pending" }));
    const { result } = renderHook(() => useRivalStats("team-1", 60_000));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.refresh();
    });

    expect(requestRivalStats).toHaveBeenCalledWith("team-1", true);
  });

  it("si la carga falla lo indica", async () => {
    vi.mocked(getRivalStats).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRivalStats("team-1", POLL_MS));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);
  });
});
