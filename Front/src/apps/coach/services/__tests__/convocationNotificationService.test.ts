import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import {
  getConvocationNotificationRecipients,
  type PlayerRecipients,
} from "../convocationNotificationService";

describe("convocationNotificationService.getConvocationNotificationRecipients", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("hace GET a /api/events/{eventId}/convocations/notification-recipients con teamPlayerIds repetidos (no notación de corchetes)", async () => {
    (client.get as any).mockResolvedValue({ data: { players: [] } });

    await getConvocationNotificationRecipients("event-1", ["tp-a", "tp-b"]);

    expect(client.get).toHaveBeenCalledTimes(1);
    const calledUrl = (client.get as any).mock.calls[0][0] as string;
    expect(calledUrl).toBe(
      "/api/events/event-1/convocations/notification-recipients?teamPlayerIds=tp-a&teamPlayerIds=tp-b"
    );
    expect(calledUrl).not.toContain("teamPlayerIds%5B%5D");
    expect(calledUrl).not.toContain("[]=");
  });

  it("devuelve resp.data.players", async () => {
    const players: PlayerRecipients[] = [
      {
        teamPlayerId: "tp-a",
        playerAlias: "Juanito",
        familyMembers: [
          {
            familyMemberId: "fm-1",
            name: "María",
            lastName: "López",
            phone: "+34600123456",
            familyMember: "Madre",
          },
        ],
      },
    ];
    (client.get as any).mockResolvedValue({ data: { players } });

    const result = await getConvocationNotificationRecipients("event-1", ["tp-a"]);

    expect(result).toEqual(players);
  });

  it("devuelve un array vacío cuando la respuesta no trae 'players'", async () => {
    (client.get as any).mockResolvedValue({ data: {} });

    const result = await getConvocationNotificationRecipients("event-1", ["tp-a"]);

    expect(result).toEqual([]);
  });
});
