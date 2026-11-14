import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), put: vi.fn() },
}));

import client from "../../../../core/api/client";
import { getTeamPositionFit, savePositionFitOrder, savePositionTraitWeights } from "../positionFitService";
import type { PositionFit } from "../../types/positionFit";

const positionFit: PositionFit = {
  position: "defensiveMidfielder",
  confirmedWeekStart: null,
  isManual: false,
  candidates: [{ teamPlayerId: "tp1", name: "Araque", place: 1, fit: 3.4, trend: "same" }],
  weights: { traitCoverage: "key" },
};

describe("positionFitService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee el encaje de todos los puestos del equipo", async () => {
    (client.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [positionFit] });

    const result = await getTeamPositionFit("team-1");

    expect(client.get).toHaveBeenCalledWith("/api/catalog/team/team-1/position-fit");
    expect(result).toEqual([positionFit]);
  });

  it("guarda el orden confirmado de un puesto", async () => {
    (client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: positionFit });

    const result = await savePositionFitOrder("team-1", "defensiveMidfielder", ["tp2", "tp1"]);

    expect(client.put).toHaveBeenCalledWith("/api/catalog/team/team-1/position-fit/defensiveMidfielder", {
      teamPlayerIds: ["tp2", "tp1"],
    });
    expect(result).toEqual(positionFit);
  });

  it("guarda los pesos de un puesto", async () => {
    (client.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: positionFit });

    const result = await savePositionTraitWeights("team-1", "forward", { traitDuels: "sum" });

    expect(client.put).toHaveBeenCalledWith("/api/catalog/team/team-1/position-fit/forward/weights", {
      weights: { traitDuels: "sum" },
    });
    expect(result).toEqual(positionFit);
  });
});
