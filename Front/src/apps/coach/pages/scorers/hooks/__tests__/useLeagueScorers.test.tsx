import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../services/leagueScorersService", () => ({
  getLeagueScorers: vi.fn(),
}));

import { getLeagueScorers, type LeagueScorersResponse } from "../../../../services/leagueScorersService";
import useLeagueScorers from "../useLeagueScorers";

const response = (round: number): LeagueScorersResponse => ({
  rounds: [7, 8],
  round,
  matches: [],
  scorers: [],
});

describe("useLeagueScorers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga los goleadores del equipo", async () => {
    vi.mocked(getLeagueScorers).mockResolvedValue(response(8));

    const { result } = renderHook(() => useLeagueScorers("team-1", undefined));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getLeagueScorers).toHaveBeenCalledWith("team-1", undefined);
    expect(result.current.data?.round).toBe(8);
    expect(result.current.error).toBe(false);
  });

  it("vuelve a pedir los datos al cambiar de jornada", async () => {
    vi.mocked(getLeagueScorers).mockImplementation(async (_team, round) => response(round ?? 8));

    const { result, rerender } = renderHook(({ round }) => useLeagueScorers("team-1", round), {
      initialProps: { round: 8 as number | undefined },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ round: 7 });

    await waitFor(() => expect(result.current.data?.round).toBe(7));
    expect(getLeagueScorers).toHaveBeenLastCalledWith("team-1", 7);
  });

  it("marca el error y permite reintentar", async () => {
    vi.mocked(getLeagueScorers).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(response(8));

    const { result } = renderHook(() => useLeagueScorers("team-1", undefined));
    await waitFor(() => expect(result.current.error).toBe(true));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.data?.round).toBe(8));
    expect(result.current.error).toBe(false);
  });

  it("no pide nada sin equipo", () => {
    const { result } = renderHook(() => useLeagueScorers(undefined, undefined));

    expect(getLeagueScorers).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
