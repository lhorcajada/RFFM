import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { getTeamConvocationsSummary, type TeamConvocationRow } from "../attendanceSummaryService";

describe("attendanceSummaryService.getTeamConvocationsSummary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hace una única llamada GET a /api/attendance/team-convocations/{teamId} y devuelve resp.data", async () => {
    const sample: TeamConvocationRow[] = [
      {
        eventId: "event-1",
        convocationId: "c1",
        teamPlayerId: "tp-1",
        playerId: "p-1",
        alias: "J1",
        statusId: 2,
        excuseTypeId: null,
        assistanceTypeId: null,
      },
    ];
    (client.get as any).mockResolvedValue({ data: sample });

    const result = await getTeamConvocationsSummary("team-1");

    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith("/api/attendance/team-convocations/team-1");
    expect(result).toEqual(sample);
  });
});
