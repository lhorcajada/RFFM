import { describe, it, expect, vi, beforeEach } from "vitest";
import { client } from "../../../core/api/client";
import { InvitationsApi } from "./invitationsApi";

vi.mock("../../../core/api/client", () => ({
  client: { post: vi.fn() },
}));

describe("InvitationsApi — preview methods", () => {
  const api = new InvitationsApi();

  beforeEach(() => {
    vi.mocked(client.post).mockReset();
  });

  it("previewClubCode posts to api/invitations/club/preview and returns the response", async () => {
    vi.mocked(client.post).mockResolvedValue({
      data: { clubId: "c1", clubName: "FC Test", membershipKind: "Coach" },
    });
    const result = await api.previewClubCode({ code: "ABC123", membershipKind: "Coach" });
    expect(client.post).toHaveBeenCalledWith(
      "/api/invitations/club/preview",
      { code: "ABC123", membershipKind: "Coach" }
    );
    expect(result.clubId).toBe("c1");
  });

  it("previewTeamCode posts to api/invitations/team/preview and returns players[]", async () => {
    vi.mocked(client.post).mockResolvedValue({
      data: {
        teamId: "t1",
        teamName: "U12",
        clubId: "c1",
        membershipKind: "Player",
        players: [
          {
            teamPlayerId: "tp1",
            playerId: "p1",
            name: "Juan",
            lastName: "Pérez",
            urlPhoto: null,
            dorsal: 9,
            alreadyLinked: false,
          },
        ],
      },
    });
    const result = await api.previewTeamCode({ code: "XYZ789", membershipKind: "Player" });
    expect(client.post).toHaveBeenCalledWith(
      "/api/invitations/team/preview",
      { code: "XYZ789", membershipKind: "Player" }
    );
    expect(result.players).toHaveLength(1);
  });
});
