import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const getTeamPlayerStatisticsMock = vi.fn();
vi.mock("../../../../services/teamPlayerStatisticsService", () => ({
  getTeamPlayerStatistics: (...args: unknown[]) => getTeamPlayerStatisticsMock(...args),
}));

import { usePlayerFormStats } from "../usePlayerFormStats";

const OTHER_PLAYER = {
  teamPlayerId: "tp-other",
  displayName: "Otro",
  position: null,
  dorsal: null,
  goals: 0,
  yellowCards: 0,
  redCards: 0,
  minutesPlayed: 0,
  trainingsAttended: 0,
  matchesPlayed: 0,
  daysSinceLastInjury: null,
  lastInjuryDurationDays: null,
  physicalFitness: 50,
  fatigue: 10,
  availability: 40,
  readiness: 60,
  readinessBreakdown: null,
};

const TARGET_PLAYER = {
  ...OTHER_PLAYER,
  teamPlayerId: "tp-1",
  displayName: "Juan Pérez",
  readiness: 88,
  fatigue: 22,
};

describe("usePlayerFormStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no llama al servicio sin teamId o sin teamPlayerId", () => {
    const { result } = renderHook(() => usePlayerFormStats());

    act(() => result.current.loadStats(undefined, "tp-1"));
    act(() => result.current.loadStats("team-1", undefined));

    expect(getTeamPlayerStatisticsMock).not.toHaveBeenCalled();
  });

  it("filtra las estadísticas del equipo para quedarse solo con las del jugador actual", async () => {
    getTeamPlayerStatisticsMock.mockResolvedValue([OTHER_PLAYER, TARGET_PLAYER]);

    const { result } = renderHook(() => usePlayerFormStats());

    await act(async () => {
      result.current.loadStats("team-1", "tp-1");
    });

    await waitFor(() => expect(result.current.loadingStats).toBe(false));
    expect(result.current.stats).toEqual(TARGET_PLAYER);
  });

  it("deja stats en null si el jugador no aparece en la respuesta del equipo", async () => {
    getTeamPlayerStatisticsMock.mockResolvedValue([OTHER_PLAYER]);

    const { result } = renderHook(() => usePlayerFormStats());

    await act(async () => {
      result.current.loadStats("team-1", "tp-1");
    });

    await waitFor(() => expect(result.current.loadingStats).toBe(false));
    expect(result.current.stats).toBeNull();
  });

  it("mantiene la pestaña usable si el servicio falla", async () => {
    getTeamPlayerStatisticsMock.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => usePlayerFormStats());

    await act(async () => {
      result.current.loadStats("team-1", "tp-1");
    });

    await waitFor(() => expect(result.current.loadingStats).toBe(false));
    expect(result.current.stats).toBeNull();
  });
});
