import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetTeamsForClassification = vi.fn();
const mockGetCalendar = vi.fn();
vi.mock("../../../apps/federation/services/api", () => ({
  getTeamsForClassification: (...args: unknown[]) => mockGetTeamsForClassification(...args),
  getCalendar: (...args: unknown[]) => mockGetCalendar(...args),
}));

import useClassification from "../useClassification";

const baseTeam = {
  played: 1,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
};

describe("useClassification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTeamsForClassification.mockResolvedValue([]);
    mockGetCalendar.mockResolvedValue({ matchDays: [] });
  });

  it("no consulta la API sin competición o grupo", () => {
    const { result } = renderHook(() =>
      useClassification({ season: "21", competition: undefined, group: "7" }),
    );

    expect(mockGetTeamsForClassification).not.toHaveBeenCalled();
    expect(result.current.teams).toEqual([]);
  });

  it("carga los equipos de la competición ordenados por puntos", async () => {
    mockGetTeamsForClassification.mockResolvedValue([
      { ...baseTeam, teamId: "b", teamName: "B", position: 2, points: 3 },
      { ...baseTeam, teamId: "a", teamName: "A", position: 1, points: 9 },
    ]);

    const { result } = renderHook(() =>
      useClassification({ season: "21", competition: "5", group: "7" }),
    );

    await waitFor(() => expect(result.current.teams.map((t) => t.teamId)).toEqual(["a", "b"]));
    expect(mockGetTeamsForClassification).toHaveBeenCalledWith({
      season: "21",
      competition: "5",
      group: "7",
      playType: "1",
    });
  });

  it("respeta el orden por posición cuando hay equipos empatados a puntos", async () => {
    mockGetTeamsForClassification.mockResolvedValue([
      { ...baseTeam, teamId: "c", teamName: "C", position: 3, points: 3 },
      { ...baseTeam, teamId: "a", teamName: "A", position: 2, points: 6 },
      { ...baseTeam, teamId: "b", teamName: "B", position: 1, points: 6 },
    ]);

    const { result } = renderHook(() =>
      useClassification({ season: "21", competition: "5", group: "7" }),
    );

    await waitFor(() => expect(result.current.teams.map((t) => t.teamId)).toEqual(["b", "a", "c"]));
  });

  it("asigna a cada equipo sus partidos del calendario con el resultado desde su punto de vista", async () => {
    mockGetTeamsForClassification.mockResolvedValue([
      { ...baseTeam, teamId: "a", teamName: "A", position: 1, points: 3 },
    ]);
    mockGetCalendar.mockResolvedValue({
      matchDays: [
        {
          date: "2026-10-10",
          matches: [
            {
              localTeamCode: "a",
              visitorTeamCode: "b",
              localTeamName: "A",
              visitorTeamName: "B",
              localGoals: "2",
              visitorGoals: "1",
            },
          ],
        },
      ],
    });

    const { result } = renderHook(() =>
      useClassification({ season: "21", competition: "5", group: "7" }),
    );

    await waitFor(() => expect(result.current.teamMatches.a).toHaveLength(1));
    expect(result.current.teamMatches.a[0]).toMatchObject({ opponent: "B", result: "G", isLocal: true });
    expect(result.current.teamMatches.b[0]).toMatchObject({ opponent: "A", result: "P", isLocal: false });
  });

  it("deja la clasificación vacía si la API falla", async () => {
    mockGetTeamsForClassification.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() =>
      useClassification({ season: "21", competition: "5", group: "7" }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([]);
  });
});
