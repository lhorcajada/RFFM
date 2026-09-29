import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCompetitions = vi.fn();
const mockGetGroups = vi.fn();
vi.mock("../../services/rffmCompetitionService", () => ({
  default: {
    getCompetitions: () => mockGetCompetitions(),
    getGroups: (id: number) => mockGetGroups(id),
  },
}));

import useRffmCompetitionNames from "../useRffmCompetitionNames";

describe("useRffmCompetitionNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCompetitions.mockResolvedValue([
      { id: 5, name: "SEGUNDA CADETE", categoryGroup: "Cadete" },
      { id: 6, name: "PRIMERA CADETE", categoryGroup: "Cadete" },
    ]);
    mockGetGroups.mockResolvedValue([
      { id: 34, name: "Grupo 34" },
      { id: 35, name: "Grupo 35" },
    ]);
  });

  it("resuelve los nombres de la competición y el grupo del equipo", async () => {
    const { result } = renderHook(() => useRffmCompetitionNames(5, 34));

    await waitFor(() =>
      expect(result.current).toEqual({ competitionName: "SEGUNDA CADETE", groupName: "Grupo 34" }),
    );
    expect(mockGetGroups).toHaveBeenCalledWith(5);
  });

  it("no consulta el catálogo si el equipo no tiene competición", () => {
    const { result } = renderHook(() => useRffmCompetitionNames(null, null));

    expect(mockGetCompetitions).not.toHaveBeenCalled();
    expect(result.current).toEqual({ competitionName: null, groupName: null });
  });

  it("deja los nombres vacíos si el catálogo falla", async () => {
    mockGetCompetitions.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRffmCompetitionNames(5, 34));

    await waitFor(() => expect(mockGetCompetitions).toHaveBeenCalled());
    expect(result.current).toEqual({ competitionName: null, groupName: null });
  });
});
