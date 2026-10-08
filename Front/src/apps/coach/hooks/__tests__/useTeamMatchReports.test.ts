import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/matchReportService", () => ({
  getTeamMatchReports: vi.fn(),
}));

import useTeamMatchReports from "../useTeamMatchReports";
import { getTeamMatchReports } from "../../services/matchReportService";

const league = { eventId: "e1", codActa: "123", hasLiveReport: false, hasFederationReport: true };
const friendly = { eventId: "e2", codActa: null, hasLiveReport: true, hasFederationReport: false };

describe("useTeamMatchReports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("indexa las actas disponibles por evento y por código de acta", async () => {
    vi.mocked(getTeamMatchReports).mockResolvedValue([league, friendly]);

    const { result } = renderHook(() => useTeamMatchReports("t1"));

    await waitFor(() => expect(result.current.byEventId.e2).toEqual(friendly));
    expect(result.current.byEventId.e1).toEqual(league);
    expect(result.current.byCodActa["123"]).toEqual(league);
    expect(Object.keys(result.current.byCodActa)).toEqual(["123"]);
  });

  it("si la carga falla no hay actas disponibles", async () => {
    vi.mocked(getTeamMatchReports).mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useTeamMatchReports("t1"));

    await waitFor(() => expect(getTeamMatchReports).toHaveBeenCalled());
    expect(result.current.byEventId).toEqual({});
  });

  it("sin equipo no consulta la API", () => {
    renderHook(() => useTeamMatchReports(undefined));

    expect(getTeamMatchReports).not.toHaveBeenCalled();
  });
});
