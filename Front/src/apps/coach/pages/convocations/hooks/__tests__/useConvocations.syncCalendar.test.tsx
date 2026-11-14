import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../federation/services/Federation", () => ({
  settingsService: {
    getSettings: vi.fn().mockResolvedValue([{ id: "s1", teamId: "juvenil-999", isPrimary: true }]),
  },
  calendarService: {
    getTeamMatches: vi.fn(),
  },
}));

vi.mock("../../../../services/sportEventService", () => ({
  default: {
    getSportEvents: vi.fn().mockResolvedValue({ items: [], pageNumber: 1, pageSize: 200, totalItems: 0, totalPages: 1 }),
    syncCalendarFromFederation: vi.fn().mockResolvedValue({ created: 1, updated: 0, failed: 0, events: [] }),
  },
}));

import useConvocations from "../useConvocations";
import { calendarService, settingsService } from "../../../../../federation/services/Federation";
import sportEventService from "../../../../services/sportEventService";

const teamSource = { season: "22", competition: "26737768", group: "26737802", teamCode: "6818362" };

const federationMatch = {
  date: "2026-11-28",
  match: {
    localTeamName: "FEPE GETAFE III 'D'",
    localTeamCode: "6818362",
    visitorTeamName: "A.D. RIVAL 'B'",
    visitorTeamCode: "111",
    date: "2026-11-28",
    time: "18:45",
    field: "Campo Municipal",
    matchRecordCode: 5655772,
  },
};

describe("useConvocations — generar calendario con la configuración del equipo del coach", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarService.getTeamMatches).mockResolvedValue([federationMatch]);
  });

  it("pide el calendario con la temporada, competición, grupo y código del equipo, no con la selección de Federación", async () => {
    const { result } = renderHook(() => useConvocations("team-1", teamSource));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSyncCalendar();
    });

    expect(calendarService.getTeamMatches).toHaveBeenCalledWith("6818362", {
      season: "22",
      competition: "26737768",
      group: "26737802",
    });
    expect(settingsService.getSettings).not.toHaveBeenCalled();
  });

  it("guarda los partidos recibidos en el equipo del coach", async () => {
    const { result } = renderHook(() => useConvocations("team-1", teamSource));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSyncCalendar();
    });

    expect(sportEventService.syncCalendarFromFederation).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        matches: [expect.objectContaining({ rivalName: "A.D. RIVAL 'B'", isHomeMatch: true, codActa: "5655772" })],
      }),
    );
  });

  it("si el equipo no tiene competición y grupo configurados, no se puede generar y no se pide nada a la federación", async () => {
    const { result } = renderHook(() => useConvocations("team-1", null));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSyncCalendar();
    });

    expect(result.current.canSyncCalendar).toBe(false);
    expect(calendarService.getTeamMatches).not.toHaveBeenCalled();
    expect(sportEventService.syncCalendarFromFederation).not.toHaveBeenCalled();
  });
});
