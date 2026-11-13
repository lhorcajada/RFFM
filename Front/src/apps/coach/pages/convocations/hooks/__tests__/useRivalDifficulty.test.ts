import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("../../../../services/matchForecastService", () => ({
  getRivalSimulation: vi.fn(),
}));

import { getRivalSimulation } from "../../../../services/matchForecastService";
import { useRivalDifficulty } from "../useRivalDifficulty";
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
});
