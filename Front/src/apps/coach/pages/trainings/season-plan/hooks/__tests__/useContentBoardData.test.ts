import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useContentBoardData } from "../useContentBoardData";

vi.mock("../../../../../services/gameModelService", () => ({
  default: {
    getByTeamIdAndSeason: vi.fn(),
    getAdnCoverage: vi.fn(),
  },
}));

vi.mock("../../../../../services/trainingService", () => ({
  default: {
    getSessions: vi.fn(),
  },
}));

const gameModelFixture = {
  id: "model-1",
  teamId: "team-1",
  name: "Modelo",
  season: "2026-2027",
  principles: [],
  setPieceRules: [],
  openIssues: [],
};

const coverageFixture = { subSubPrincipios: [], subprincipios: [], principios: [] };

const sessionsFixture = [
  { id: "sess-1", name: "Sesión 1", description: "", date: null, startTime: null, isAssociatedToPlan: false, exerciseCount: 0, targets: [] },
];

describe("useContentBoardData", () => {
  beforeEach(() => vi.clearAllMocks());

  it("carga GameModel, AdnCoverage y Sessions en paralelo y expone loading=false al terminar", async () => {
    const gameModelService = (await import("../../../../../services/gameModelService")).default;
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (gameModelService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockResolvedValue(gameModelFixture);
    (gameModelService.getAdnCoverage as ReturnType<typeof vi.fn>).mockResolvedValue(coverageFixture);
    (trainingService.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue(sessionsFixture);

    const { result } = renderHook(() => useContentBoardData("team-1", "2026-2027"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.gameModel).toEqual(gameModelFixture);
    expect(result.current.coverage).toEqual(coverageFixture);
    expect(result.current.sessions).toEqual(sessionsFixture);
    expect(result.current.error).toBeNull();
    expect(gameModelService.getByTeamIdAndSeason).toHaveBeenCalledWith("team-1", "2026-2027");
    expect(gameModelService.getAdnCoverage).toHaveBeenCalledWith("team-1", "2026-2027");
    expect(trainingService.getSessions).toHaveBeenCalledWith("team-1");
  });

  it("expone un error y deja de cargar si una de las llamadas falla", async () => {
    const gameModelService = (await import("../../../../../services/gameModelService")).default;
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (gameModelService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    (gameModelService.getAdnCoverage as ReturnType<typeof vi.fn>).mockResolvedValue(coverageFixture);
    (trainingService.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue(sessionsFixture);

    const { result } = renderHook(() => useContentBoardData("team-1", "2026-2027"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).not.toBeNull();
  });

  it("refetchSessions vuelve a pedir solo las sesiones", async () => {
    const gameModelService = (await import("../../../../../services/gameModelService")).default;
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (gameModelService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockResolvedValue(gameModelFixture);
    (gameModelService.getAdnCoverage as ReturnType<typeof vi.fn>).mockResolvedValue(coverageFixture);
    (trainingService.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue(sessionsFixture);

    const { result } = renderHook(() => useContentBoardData("team-1", "2026-2027"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.clearAllMocks();
    (trainingService.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    await result.current.refetchSessions();

    expect(trainingService.getSessions).toHaveBeenCalledTimes(1);
    expect(gameModelService.getAdnCoverage).not.toHaveBeenCalled();
  });

  it("refetchCoverage vuelve a pedir solo la cobertura", async () => {
    const gameModelService = (await import("../../../../../services/gameModelService")).default;
    const trainingService = (await import("../../../../../services/trainingService")).default;
    (gameModelService.getByTeamIdAndSeason as ReturnType<typeof vi.fn>).mockResolvedValue(gameModelFixture);
    (gameModelService.getAdnCoverage as ReturnType<typeof vi.fn>).mockResolvedValue(coverageFixture);
    (trainingService.getSessions as ReturnType<typeof vi.fn>).mockResolvedValue(sessionsFixture);

    const { result } = renderHook(() => useContentBoardData("team-1", "2026-2027"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.clearAllMocks();
    (gameModelService.getAdnCoverage as ReturnType<typeof vi.fn>).mockResolvedValue({ ...coverageFixture });

    await result.current.refetchCoverage();

    expect(gameModelService.getAdnCoverage).toHaveBeenCalledTimes(1);
    expect(trainingService.getSessions).not.toHaveBeenCalled();
  });
});
