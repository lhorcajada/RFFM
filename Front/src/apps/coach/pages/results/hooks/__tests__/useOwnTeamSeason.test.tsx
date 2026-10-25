import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCalendar = vi.fn();
vi.mock("../../../../../federation/services/api", () => ({
  getCalendar: (params: unknown) => mockGetCalendar(params),
}));

import useOwnTeamSeason from "../useOwnTeamSeason";

const own1 = { matchRecordCode: "a", localTeamCode: "100", visitorTeamCode: "200", localTeamName: "Mi Equipo", visitorTeamName: "Rival" };
const other1 = { matchRecordCode: "b", localTeamCode: "300", visitorTeamCode: "400", localTeamName: "X", visitorTeamName: "Y" };
const ownBye2 = { matchRecordCode: "", localTeamCode: "100", visitorTeamCode: "", localTeamName: "Mi Equipo", visitorTeamName: "Descansa" };

const params = { season: "21", competition: "555", group: "777", teamCode: "100" };

describe("useOwnTeamSeason", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pide una sola vez el calendario completo con temporada, competición y grupo", async () => {
    mockGetCalendar.mockResolvedValue({ matchDays: [] });

    const { result } = renderHook(() => useOwnTeamSeason(params));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetCalendar).toHaveBeenCalledTimes(1);
    expect(mockGetCalendar).toHaveBeenCalledWith({ season: "21", competition: "555", group: "777" });
  });

  it("devuelve el partido propio o el descanso por número de jornada", async () => {
    mockGetCalendar.mockResolvedValue({
      matchDays: [
        { matchDayNumber: 1, date: "2026-09-13", matches: [other1, own1] },
        { matchDayNumber: 2, date: "2026-09-20", matches: [ownBye2, other1] },
        { matchDayNumber: 3, date: "2026-09-27", matches: [other1] },
      ],
    });

    const { result } = renderHook(() => useOwnTeamSeason(params));

    await waitFor(() => expect(result.current.ownByRound[1]).toEqual(own1));
    expect(result.current.ownByRound[2]).toBe("bye");
    expect(result.current.ownByRound[3]).toBeUndefined();
  });

  it("no pide el calendario sin código de equipo", () => {
    const { result } = renderHook(() => useOwnTeamSeason({ ...params, teamCode: null }));

    expect(mockGetCalendar).not.toHaveBeenCalled();
    expect(result.current.ownByRound).toEqual({});
  });

  it("expone el error si falla la carga", async () => {
    mockGetCalendar.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useOwnTeamSeason(params));

    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.ownByRound).toEqual({});
  });
});
