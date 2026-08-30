import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockPut = vi.fn();

vi.mock("../../../../core/api/client", () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
}));

import teamUsersService from "../teamUsersService";

describe("teamUsersService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTeamUsers", () => {
    it("calls client.get with /api/coaches/team-users and params object containing teamId", async () => {
      const fixture = {
        teamId: "team-1",
        teamName: "Cadete D",
        callerIsCreator: true,
        users: [
          {
            membershipId: "mem-1",
            userId: "user-1",
            alias: "Entrenador Principal",
            email: "coach@example.com",
            membershipKind: "Coach" as const,
            joinedAt: "2026-01-15T10:00:00Z",
            isCreator: true,
            isSelf: true,
            isApproved: true,
            linkedPlayerFullName: null,
          },
          {
            membershipId: "mem-2",
            userId: "user-2",
            alias: "Ayudante",
            email: "assistant@example.com",
            membershipKind: "Coach" as const,
            joinedAt: "2026-02-20T14:30:00Z",
            isCreator: false,
            isSelf: false,
            isApproved: false,
            linkedPlayerFullName: null,
          },
        ],
      };
      mockGet.mockResolvedValue({ status: 200, data: fixture });

      const result = await teamUsersService.getTeamUsers("team-1");

      expect(mockGet).toHaveBeenCalledWith("/api/coaches/team-users", {
        params: { teamId: "team-1" },
      });
      expect(result).toEqual(fixture);
    });

    it("propagates errors from the API (e.g. 403 Forbidden)", async () => {
      const error = { response: { status: 403 } };
      mockGet.mockRejectedValue(error);

      await expect(teamUsersService.getTeamUsers("team-1")).rejects.toBe(error);
    });
  });

  describe("deleteTeamUserAccount", () => {
    it("calls client.delete with URL-encoded membershipId", async () => {
      mockDelete.mockResolvedValue({ status: 204 });

      await teamUsersService.deleteTeamUserAccount("membership-1");

      expect(mockDelete).toHaveBeenCalledWith(
        `/api/coaches/team-users/${encodeURIComponent("membership-1")}`
      );
    });

    it("propagates errors from the API (e.g. 400 Bad Request for self-delete)", async () => {
      const error = { response: { status: 400 } };
      mockDelete.mockRejectedValue(error);

      await expect(
        teamUsersService.deleteTeamUserAccount("membership-1")
      ).rejects.toBe(error);
    });
  });

  describe("setTeamUserApproval", () => {
    it("calls client.put with the approval endpoint and { approved } body", async () => {
      mockPut.mockResolvedValue({ status: 204 });

      await teamUsersService.setTeamUserApproval("membership-1", true);

      expect(mockPut).toHaveBeenCalledWith(
        `/api/coaches/team-users/${encodeURIComponent("membership-1")}/approval`,
        { approved: true }
      );
    });

    it("propagates errors from the API (e.g. 403 Forbidden)", async () => {
      const error = { response: { status: 403 } };
      mockPut.mockRejectedValue(error);

      await expect(
        teamUsersService.setTeamUserApproval("membership-1", false)
      ).rejects.toBe(error);
    });
  });
});
