import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../services/configurationCoachService", () => ({
  default: {
    getCurrent: vi.fn(),
  },
}));

import configurationCoachService from "../../services/configurationCoachService";
import { resolveTeamDashboardPath } from "../useTeamDashboardBack";

describe("resolveTeamDashboardPath", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("resolves to the concrete team's dashboard when teamId is present in the URL", async () => {
    const path = await resolveTeamDashboardPath("?teamId=team-123");

    expect(path).toBe("/coach/team-dashboard?teamId=team-123");
  });

  it("falls back to the coach's preferred team when no teamId is present in the URL", async () => {
    (configurationCoachService.getCurrent as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1,
      coachId: "coach-1",
      preferredTeamId: "team-456",
    });

    const path = await resolveTeamDashboardPath("");

    expect(path).toBe("/coach/team-dashboard?teamId=team-456");
  });

  it("falls back to the general coach dashboard only when no team can be determined at all", async () => {
    (configurationCoachService.getCurrent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const path = await resolveTeamDashboardPath("");

    expect(path).toBe("/coach/dashboard");
  });
});
