import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../../../../services/matchForecastService", () => ({
  getRivalSimulation: vi.fn(),
}));

import { getRivalSimulation } from "../../../../services/matchForecastService";
import { useRivalDifficulty, useRivalOutlook } from "../useRivalDifficulty";
import { DEFAULT_RULES } from "../../utils/rules/defaultRules";

const mockGet = getRivalSimulation as ReturnType<typeof vi.fn>;

const simulation = (win: number) => ({
  ownTeamCode: "own",
  matches: [
    {
      round: 3,
      localTeamCode: "own",
      localTeamName: "Mi Equipo",
      visitorTeamCode: "r",
      visitorTeamName: "Vallecas CF",
      localWinProbability: win,
      visitorWinProbability: 0.2,
    },
  ],
});

describe("useRivalDifficulty", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("es medio mientras carga", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useRivalDifficulty("t1", "Vallecas CF", DEFAULT_RULES));

    expect(result.current).toBe("medium");
  });

  it("es difícil cuando la probabilidad de victoria es baja", async () => {
    mockGet.mockResolvedValue(simulation(0.32));
    const { result } = renderHook(() => useRivalDifficulty("t1", "Vallecas CF", DEFAULT_RULES));

    await waitFor(() => expect(result.current).toBe("hard"));
  });

  it("es medio si el pronóstico no se puede leer", async () => {
    mockGet.mockRejectedValue(new Error("404"));
    const { result } = renderHook(() => useRivalDifficulty("t1", "Vallecas CF", DEFAULT_RULES));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toBe("medium");
  });

  it("es medio sin la regla de dificultad aunque el rival sea difícil", async () => {
    mockGet.mockResolvedValue(simulation(0.1));
    const rules = DEFAULT_RULES.filter((r) => r.condition !== "rivalDifficulty");
    const { result } = renderHook(() => useRivalDifficulty("t1", "Vallecas CF", rules));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(result.current).toBe("medium");
  });

  it("no consulta nada sin equipo ni rival", () => {
    renderHook(() => useRivalDifficulty("", null, DEFAULT_RULES));

    expect(mockGet).not.toHaveBeenCalled();
  });

  it("expone los partidos siguientes con rival, fecha y dificultad", async () => {
    mockGet.mockResolvedValue({
      ownTeamCode: "own",
      matches: [
        { round: 3, date: "2026-10-21", localTeamCode: "own", localTeamName: "Mi Equipo", visitorTeamCode: "r", visitorTeamName: "Vallecas CF", localWinProbability: 0.5, visitorWinProbability: 0.2 },
        { round: 4, date: "2026-10-28", localTeamCode: "g", localTeamName: "Getafe", visitorTeamCode: "own", visitorTeamName: "Mi Equipo", localWinProbability: 0.7, visitorWinProbability: 0.2 },
      ],
    });
    const { result } = renderHook(() => useRivalOutlook("t1", "Vallecas CF", DEFAULT_RULES, "2026-10-21"));

    await waitFor(() => expect(result.current.upcomingMatches).toHaveLength(1));
    expect(result.current.upcomingMatches[0]).toMatchObject({ round: 4, rival: "Getafe", date: "2026-10-28", difficulty: "hard" });
    expect(result.current.upcoming).toEqual(["hard"]);
    expect(result.current.winProbability).toBe(0.5);
    expect(result.current.upcomingMatches[0].winProbability).toBe(0.2);
  });
});
