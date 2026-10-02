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
import {
  createPlayerObservation,
  deletePlayerObservation,
  deleteSessionEvaluation,
  getPlayerObservations,
  getSessionEvaluation,
  getSessionEvaluations,
  periodStart,
  saveSessionEvaluation,
  updatePlayerObservation,
} from "../playerTrackingService";
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
  trainingSessionId: null,
  trainingSessionName: null,
  attitudeKey: null,
  attitudeLabel: null,
  habilidades: [],
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

  it("updatePlayerObservation envía el PUT con valoración y comentario y devuelve la observación", async () => {
    const updated = { ...observation, assessment: "Partial" as const, comment: "Mejora" };
    vi.mocked(client.put).mockResolvedValue({ data: updated });

    const result = await updatePlayerObservation("team-1", "tp-1", "obs-1", { assessment: "Partial", comment: "Mejora" });

    expect(client.put).toHaveBeenCalledWith("/api/teams/team-1/players/tp-1/observations/obs-1", {
      assessment: "Partial",
      comment: "Mejora",
    });
    expect(result).toEqual(updated);
  });

  it("deletePlayerObservation envía el DELETE de la observación", async () => {
    vi.mocked(client.delete).mockResolvedValue({ data: undefined });

    await deletePlayerObservation("team-1", "tp-1", "obs-1");

    expect(client.delete).toHaveBeenCalledWith("/api/teams/team-1/players/tp-1/observations/obs-1");
  });

  it("getPlayerObservations envía el inicio del periodo cuando se indica", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: [] });

    await getPlayerObservations("team-1", "tp-1", "2026-09-01");

    expect(client.get).toHaveBeenCalledWith("/api/teams/team-1/players/tp-1/observations", {
      params: { from: "2026-09-01" },
    });
  });

  it("periodStart calcula el inicio de cada periodo", () => {
    const today = new Date("2026-10-01T12:00:00Z");

    expect(periodStart("month", today)).toBe("2026-09-01");
    expect(periodStart("quarter", today)).toBe("2026-07-03");
    expect(periodStart("all", today)).toBeUndefined();
  });

  describe("seguimiento por sesión", () => {
    const base = "/api/teams/team-1/players/tp-1/session-evaluations";

    it("getSessionEvaluations pide la lista de sesiones del jugador", async () => {
      vi.mocked(client.get).mockResolvedValue({ data: [] });

      const result = await getSessionEvaluations("team-1", "tp-1");

      expect(client.get).toHaveBeenCalledWith(base);
      expect(result).toEqual([]);
    });

    it("saveSessionEvaluation envía el PUT con las valoraciones", async () => {
      const saved = { id: "ev-1" };
      vi.mocked(client.put).mockResolvedValue({ data: saved });
      const items = [{ subprincipioId: "sub-1", assessment: "NotAchieved" as const, comment: "Busca el pase vertical" }];

      const result = await saveSessionEvaluation("team-1", "tp-1", "ses-1", items);

      expect(client.put).toHaveBeenCalledWith(`${base}/ses-1`, { evaluations: items });
      expect(result).toEqual(saved);
    });

    it("getSessionEvaluation pide el seguimiento de la sesión", async () => {
      vi.mocked(client.get).mockResolvedValue({ data: { id: "ev-1" } });

      await getSessionEvaluation("team-1", "tp-1", "ses-1");

      expect(client.get).toHaveBeenCalledWith(`${base}/ses-1`);
    });

    it("deleteSessionEvaluation borra el seguimiento de la sesión", async () => {
      vi.mocked(client.delete).mockResolvedValue({ data: undefined });

      await deleteSessionEvaluation("team-1", "tp-1", "ses-1");

      expect(client.delete).toHaveBeenCalledWith(`${base}/ses-1`);
    });
  });
});
