import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../services/api", () => ({
  getTeamsGoalSectorsComparison: vi.fn(),
  getTeamMatches: vi.fn(),
  getActa: vi.fn(),
}));

vi.mock("../../../../../../shared/context/RffmSeasonContext", () => ({
  useRffmSeason: () => ({ seasonId: 21 }),
}));

import { getActa, getTeamMatches, getTeamsGoalSectorsComparison } from "../../../../services/api";
import { useGoalSectorsComparison } from "../useGoalSectorsComparison";

const selection = {
  team1: { competitionId: "100", groupId: "200", teamCode: "11" },
  team2: { competitionId: "300", groupId: "400", teamCode: "21" },
};

function sectors(matchTime: number, lastAgainst: number) {
  const len = matchTime / 6;
  return Array.from({ length: 6 }, (_, i) => ({
    startMinute: i * len + 1,
    endMinute: (i + 1) * len,
    goalsFor: 0,
    goalsAgainst: i === 5 ? lastAgainst : 0,
  }));
}

describe("useGoalSectorsComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTeamsGoalSectorsComparison).mockResolvedValue([
      { teamCode: "11", teamName: "Equipo A", matchTime: 60, matchesProcessed: 1, totalGoalsFor: 0, totalGoalsAgainst: 1, sectors: sectors(60, 1) },
      { teamCode: "21", teamName: "Equipo B", matchTime: 90, matchesProcessed: 1, totalGoalsFor: 0, totalGoalsAgainst: 1, sectors: sectors(90, 1) },
    ]);
    vi.mocked(getTeamMatches).mockResolvedValue([{ codacta: "B1" }]);
    vi.mocked(getActa).mockResolvedValue({
      codacta: "B1",
      codigo_equipo_local: "21",
      codigo_equipo_visitante: "22",
      goles_equipo_local: [],
      goles_equipo_visitante: [{ minuto: "80", nombre_jugador: "Rival" }],
    });
  });

  it("envía la temporada RFFM seleccionada al comparar", async () => {
    const { result } = renderHook(() => useGoalSectorsComparison());
    act(() => result.current.setSelection(selection));

    act(() => result.current.handleCompare());

    await waitFor(() =>
      expect(getTeamsGoalSectorsComparison).toHaveBeenCalledWith(
        expect.objectContaining({ season: "21" }),
      ),
    );
  });

  it("envía la competición y el grupo del equipo 2 al comparar", async () => {
    const { result } = renderHook(() => useGoalSectorsComparison());
    act(() => result.current.setSelection(selection));

    act(() => result.current.handleCompare());

    await waitFor(() =>
      expect(getTeamsGoalSectorsComparison).toHaveBeenCalledWith({
        season: "21",
        teamCode: "11",
        competitionId: "100",
        groupId: "200",
        teamCode1: "11",
        teamCode2: "21",
        competitionId2: "300",
        groupId2: "400",
      }),
    );
  });

  it("el detalle de goles en contra del equipo 2 usa su competición, grupo y tramo", async () => {
    const { result } = renderHook(() => useGoalSectorsComparison());
    act(() => result.current.setSelection(selection));
    act(() => result.current.handleCompare());
    await waitFor(() => expect(result.current.comparison.rows).toHaveLength(1));

    await act(() => result.current.handleGoalsAgainstClick(result.current.comparison.rows[0], 1));

    expect(getTeamMatches).toHaveBeenCalledWith("21", {
      season: "21",
      competition: "300",
      group: "400",
    });
    expect(getActa).toHaveBeenCalledWith("B1", {
      temporada: "21",
      competicion: "300",
      grupo: "400",
    });
    expect(result.current.sectorPopup.matches[0]?.goals[0]?.minute).toBe("80");
  });
});
