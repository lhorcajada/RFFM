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
          id: "ev-1",
          eventTypeId: 1,
          eveDateTime: "2026-09-05T10:00:00",
          rivalName: "Rival FC",
        },
      ],
      pageNumber: 1,
      pageSize: 200,
      totalItems: 1,
      totalPages: 1,
    }),
  },
}));

import useConvocations from "../useConvocations";

describe("useConvocations bajo React.StrictMode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("termina la carga y expone los partidos aunque los efectos se dupliquen (StrictMode)", async () => {
    const { result } = renderHook(() => useConvocations("team-1"), {
      wrapper: React.StrictMode,
    });

    await waitFor(() => {
      expect(result.current.matches).toHaveLength(1);
    });

    expect(result.current.matches[0].eventId).toBe("ev-1");
    expect(result.current.loading).toBe(false);
  });
});
