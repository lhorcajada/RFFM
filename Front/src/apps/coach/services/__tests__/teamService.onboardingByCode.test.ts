import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import client from "../../../../core/api/client";
import { getTeamPlayersForSelection, verifyPlayerIdentity } from "../teamService";

describe("teamService onboarding por código de equipo", () => {
  beforeEach(() => vi.resetAllMocks());

  it("envía el código de equipo como query joinCode al pedir la lista de jugadores", async () => {
    (client.get as any).mockResolvedValue({ data: { teamId: "team-1", teamName: "Alevín A", players: [] } });

    await getTeamPlayersForSelection("team-1", "ABCD1234");

    const url = (client.get as any).mock.calls[0][0] as string;
    expect(url).toContain("/api/catalog/team/team-1/players-for-selection");
    expect(url).toContain("joinCode=ABCD1234");
  });

  it("envía el código de equipo como campo joinCode al verificar la identidad del jugador", async () => {
    (client.post as any).mockResolvedValue({ data: { playerId: "tp-1", teamId: "team-1", teamName: "Alevín A" } });

    await verifyPlayerIdentity("team-1", "tp-1", "ABCD1234");

    expect(client.post).toHaveBeenCalledWith(
      "/api/catalog/team/team-1/verify-player",
      expect.objectContaining({ teamPlayerId: "tp-1", joinCode: "ABCD1234" })
    );
  });
});
