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
import { getTeamFund } from "../teamFundService";
import type { TeamFundResponse } from "../teamFundService";

describe("teamFundService — getTeamFund", () => {
  beforeEach(() => vi.resetAllMocks());

  it("consulta el endpoint del fondo del equipo y devuelve el balance y los movimientos", async () => {
    const response: TeamFundResponse = {
      teamId: "team-1",
      balance: 120,
      movements: [
        {
          id: "m1",
          amount: 40,
          source: "SanctionPayment",
          sourceSanctionId: "s1",
          occurredAt: "2026-01-01T00:00:00Z",
          description: null,
        },
      ],
    };
    (client.get as any).mockResolvedValue({ data: response });

    const res = await getTeamFund("team-1");

    expect(client.get).toHaveBeenCalledWith("/api/catalog/team/team-1/fund");
    expect(res).toEqual(response);
  });

  it("devuelve null si la petición falla", async () => {
    (client.get as any).mockRejectedValue(new Error("network error"));

    const res = await getTeamFund("team-1");

    expect(res).toBeNull();
  });
});
