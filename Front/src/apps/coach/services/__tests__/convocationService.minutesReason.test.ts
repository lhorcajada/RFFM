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
import { getConvocations, updateConvocationMinutesReason } from "../convocationService";

describe("convocationService — minutes reason", () => {
  beforeEach(() => vi.resetAllMocks());

  it("updateConvocationMinutesReason calls PUT .../minutes-reason with the reason payload", async () => {
    (client.put as any).mockResolvedValue({ data: undefined });

    await updateConvocationMinutesReason("event-1", "conv-1", "Vuelta de vacaciones");

    expect(client.put).toHaveBeenCalledWith(
      "/api/events/event-1/convocations/conv-1/minutes-reason",
      { reason: "Vuelta de vacaciones" },
    );
  });

  it("updateConvocationMinutesReason submits null to clear a previously set reason", async () => {
    (client.put as any).mockResolvedValue({ data: undefined });

    await updateConvocationMinutesReason("event-1", "conv-1", null);

    expect(client.put).toHaveBeenCalledWith(
      "/api/events/event-1/convocations/conv-1/minutes-reason",
      { reason: null },
    );
  });

  it("getConvocations maps minutesReason from the backend response", async () => {
    (client.get as any).mockResolvedValue({
      data: [
        {
          id: "conv-1",
          teamPlayerId: "p1",
          statusId: 2,
          minutesReason: "Decisión técnica",
        },
        {
          id: "conv-2",
          teamPlayerId: "p2",
          statusId: 2,
          minutesReason: null,
        },
      ],
    });

    const res = await getConvocations("event-1");

    expect(res[0].minutesReason).toBe("Decisión técnica");
    expect(res[1].minutesReason).toBeNull();
  });
});
