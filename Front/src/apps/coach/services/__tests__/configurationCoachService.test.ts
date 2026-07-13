import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  default: { get: (...args: unknown[]) => mockGet(...args) },
}));

import configurationCoachService from "../configurationCoachService";

describe("configurationCoachService.getCurrent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the coach's own row when getAll() returns exactly one row", async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 1, coachId: "coach-A", preferredClubId: "club-A", preferredTeamId: null }],
    });

    const result = await configurationCoachService.getCurrent();

    expect(result).toEqual({ id: 1, coachId: "coach-A", preferredClubId: "club-A", preferredTeamId: null });
  });

  it("returns null when getAll() returns no rows (new coach)", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const result = await configurationCoachService.getCurrent();

    expect(result).toBeNull();
  });
});
