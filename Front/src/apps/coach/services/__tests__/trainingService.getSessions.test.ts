import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  client: { get: vi.fn() },
}));

import { client } from "../../../../core/api/client";
import trainingService from "../trainingService";

const mockGet = client.get as unknown as ReturnType<typeof vi.fn>;

describe("trainingService.getSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGet.mockResolvedValue({ data: [] });
  });

  it("envía la temporada cuando se indica", async () => {
    await trainingService.getSessions("team-1", "season-1");

    expect(mockGet).toHaveBeenCalledWith("/api/trainings/sessions", {
      params: { teamId: "team-1", seasonId: "season-1" },
    });
  });

  it("no envía temporada cuando no se indica", async () => {
    await trainingService.getSessions("team-1");

    expect(mockGet).toHaveBeenCalledWith("/api/trainings/sessions", { params: { teamId: "team-1" } });
  });
});
