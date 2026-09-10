import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { updateMatchParticipationReason } from "../liveMatchService";

describe("liveMatchService — minutes reason", () => {
  beforeEach(() => vi.resetAllMocks());

  it("calls PUT .../match-participation/{teamPlayerId}/reason with the reason payload", async () => {
    (client.put as any).mockResolvedValue({ data: undefined });

    await updateMatchParticipationReason("event-1", "player-1", "Buen partido, listo para más minutos");

    expect(client.put).toHaveBeenCalledWith(
      "/api/events/event-1/match-participation/player-1/reason",
      { reason: "Buen partido, listo para más minutos" },
    );
  });

  it("submits null to clear a previously set post-match reason", async () => {
    (client.put as any).mockResolvedValue({ data: undefined });

    await updateMatchParticipationReason("event-1", "player-1", null);

    expect(client.put).toHaveBeenCalledWith(
      "/api/events/event-1/match-participation/player-1/reason",
      { reason: null },
    );
  });

  it("propagates a 404 error when there is no participation row yet for the player", async () => {
    const notFound = { response: { status: 404, data: { detail: "MatchParticipationNotFound" } } };
    (client.put as any).mockRejectedValue(notFound);

    await expect(
      updateMatchParticipationReason("event-1", "player-without-participation", "motivo"),
    ).rejects.toBe(notFound);
  });
});
