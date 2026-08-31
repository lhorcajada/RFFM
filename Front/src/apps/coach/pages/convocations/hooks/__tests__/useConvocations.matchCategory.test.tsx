import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../federation/services/Federation", () => ({
  settingsService: {
    getSettings: vi.fn().mockResolvedValue([{ id: "s1", teamId: "fed-team-1", isPrimary: true }]),
  },
  calendarService: {
    getTeamMatches: vi.fn(),
  },
}));

vi.mock("../../../../services/sportEventService", () => ({
  default: {
    getSportEvents: vi.fn().mockResolvedValue({
      items: [
        {
          id: "ev-league",
          eventTypeId: 1,
          matchCategory: "League",
          eveDateTime: "2026-09-05T10:00:00",
          rivalName: "Rival FC",
        },
        {
          id: "ev-friendly",
          eventTypeId: 4,
          matchCategory: "Friendly",
          eveDateTime: "2026-09-06T10:00:00",
          rivalName: "Amistoso FC",
        },
        {
          id: "ev-tournament",
          eventTypeId: 6,
          matchCategory: "Tournament",
          eveDateTime: "2026-09-07T10:00:00",
          rivalName: "Torneo FC",
        },
        {
          id: "ev-training",
          eventTypeId: 2,
          matchCategory: null,
          eveDateTime: "2026-09-08T10:00:00",
          rivalName: null,
        },
      ],
      pageNumber: 1,
      pageSize: 200,
      totalItems: 4,
      totalPages: 1,
    }),
  },
}));

import useConvocations from "../useConvocations";

describe("useConvocations — categorías de partido (liga/amistoso/torneo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("incluye partidos de liga, amistosos y torneos en el calendario, excluyendo eventos no relevantes", async () => {
    const { result } = renderHook(() => useConvocations("team-1"));

    await waitFor(() => {
      expect(result.current.matches).toHaveLength(3);
    });

    const ids = result.current.matches.map((m) => m.eventId).sort();
    expect(ids).toEqual(["ev-friendly", "ev-league", "ev-tournament"]);
  });

  it("propaga matchCategory a cada partido normalizado", async () => {
    const { result } = renderHook(() => useConvocations("team-1"));

    await waitFor(() => {
      expect(result.current.matches).toHaveLength(3);
    });

    const byId = Object.fromEntries(result.current.matches.map((m) => [m.eventId, m.matchCategory]));
    expect(byId["ev-league"]).toBe("League");
    expect(byId["ev-friendly"]).toBe("Friendly");
    expect(byId["ev-tournament"]).toBe("Tournament");
  });
});
