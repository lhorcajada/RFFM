import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import { createPlayerObservation, getPlayerObservations } from "../playerTrackingService";
import type { PlayerObservation } from "../playerTrackingService";

const observation: PlayerObservation = {
  id: "obs-1",
  date: "2026-09-14",
  kind: "GameModel",
  subprincipioId: "sub-1",
  momentName: "Ataque organizado",
  principleLabel: "2. Ataque posicional",
  subprincipioLabel: "2.3 Circular para desordenar",
  assessment: "NotAchieved",
  comment: "Busca siempre el pase vertical",
  createdAt: "2026-09-14T18:00:00Z",
};

describe("playerTrackingService", () => {
  beforeEach(() => vi.resetAllMocks());

  it("getPlayerObservations llama al GET de observaciones del jugador y devuelve la respuesta", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [observation] });

    const result = await getPlayerObservations("team-1", "tp-1");

    expect(client.get).toHaveBeenCalledWith("/api/teams/team-1/players/tp-1/observations");
    expect(result).toEqual([observation]);
  });

  it("createPlayerObservation envía el POST con la request y devuelve la observación creada", async () => {
    vi.mocked(client.post).mockResolvedValue({ data: observation });
    const request = {
      date: "2026-09-14",
      subprincipioId: "sub-1",
      assessment: "NotAchieved" as const,
      comment: "Busca siempre el pase vertical",
    };

    const result = await createPlayerObservation("team-1", "tp-1", request);

    expect(client.post).toHaveBeenCalledWith("/api/teams/team-1/players/tp-1/observations", request);
    expect(result).toEqual(observation);
  });
});
