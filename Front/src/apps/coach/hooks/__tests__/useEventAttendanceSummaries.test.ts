import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useEventAttendanceSummaries } from "../useEventAttendanceSummaries";

vi.mock("../../services/eventAttendanceSummaryService", () => ({
  getEventAttendanceSummaries: vi.fn(),
}));

import * as eventAttendanceSummaryService from "../../services/eventAttendanceSummaryService";

describe("useEventAttendanceSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches once for a given (teamId, eventIds) pair and returns a map keyed by eventId", async () => {
    const mockSummaries = [
      {
        eventId: "e1",
        convocados: 2,
        going: 1,
        pending: 1,
        notGoing: 0,
        attendancePercentage: 50,
        myStatus: null,
        myStatusId: null,
      },
    ];

    vi.mocked(eventAttendanceSummaryService.getEventAttendanceSummaries).mockResolvedValue(
      mockSummaries
    );

    const { result } = renderHook(() =>
      useEventAttendanceSummaries("team1", ["e1"])
    );

    await waitFor(() => {
      expect(result.current.summaries["e1"]).toBeDefined();
    });

    expect(result.current.summaries["e1"]).toEqual(mockSummaries[0]);
  });

  it("does not refetch when eventIds array identity changes but contents don't", async () => {
    const mockSummaries = [
      {
        eventId: "e1",
        convocados: 2,
        going: 1,
        pending: 1,
        notGoing: 0,
        attendancePercentage: 50,
        myStatus: null,
        myStatusId: null,
      },
    ];

    vi.mocked(eventAttendanceSummaryService.getEventAttendanceSummaries).mockResolvedValue(
      mockSummaries
    );

    const { rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useEventAttendanceSummaries("team1", ids),
      {
        initialProps: { ids: ["e1"] },
      }
    );

    await waitFor(() => {
      expect(eventAttendanceSummaryService.getEventAttendanceSummaries).toHaveBeenCalledTimes(1);
    });

    // Re-render with a new array instance but same contents
    rerender({ ids: ["e1"] });

    // Still should only be called once
    expect(eventAttendanceSummaryService.getEventAttendanceSummaries).toHaveBeenCalledTimes(1);
  });
});
