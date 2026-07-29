import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import client from "../../../../core/api/client";
import rffmCompetitionService, {
  getCompetitions,
  getGroups,
  updateTeamCompetition,
} from "../rffmCompetitionService";

describe("rffmCompetitionService.getCompetitions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetches the real RFFM competitions catalog", async () => {
    const sample = [
      { id: 1, name: "Liga Nacional", categoryGroup: "Cadete" },
      { id: 2, name: "Liga Regional", categoryGroup: "Infantil" },
    ];
    (client.get as any).mockResolvedValue({ data: sample });

    const res = await getCompetitions();

    expect(client.get).toHaveBeenCalledWith("competitions");
    expect(res).toEqual(sample);
  });

  it("returns an empty array when the response has no data", async () => {
    (client.get as any).mockResolvedValue({ data: null });

    const res = await getCompetitions();

    expect(res).toEqual([]);
  });
});

describe("rffmCompetitionService.getGroups", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("fetches the groups for a given competition id", async () => {
    const sample = [{ id: 10, name: "Grupo A" }];
    (client.get as any).mockResolvedValue({ data: sample });

    const res = await getGroups(1);

    expect(client.get).toHaveBeenCalledWith("groups?competitionId=1");
    expect(res).toEqual(sample);
  });

  it("returns an empty array when the response has no data", async () => {
    (client.get as any).mockResolvedValue({ data: undefined });

    const res = await getGroups(1);

    expect(res).toEqual([]);
  });
});

describe("rffmCompetitionService.updateTeamCompetition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("associates a competition and group to an existing team", async () => {
    (client.put as any).mockResolvedValue({ data: {} });

    await updateTeamCompetition("team-1", { competitionId: 1, groupId: 10 });

    expect(client.put).toHaveBeenCalledWith("/api/catalog/team/team-1/competition", {
      RffmCompetitionId: 1,
      RffmGroupId: 10,
    });
  });

  it("clears the competition and group when both are null", async () => {
    (client.put as any).mockResolvedValue({ data: {} });

    await updateTeamCompetition("team-1", { competitionId: null, groupId: null });

    expect(client.put).toHaveBeenCalledWith("/api/catalog/team/team-1/competition", {
      RffmCompetitionId: null,
      RffmGroupId: null,
    });
  });

  it("rejects when teamId is missing", async () => {
    await expect(
      updateTeamCompetition("", { competitionId: 1, groupId: 10 })
    ).rejects.toThrow("teamId is required");
    expect(client.put).not.toHaveBeenCalled();
  });
});

describe("rffmCompetitionService default export", () => {
  it("exposes all functions", () => {
    expect(rffmCompetitionService.getCompetitions).toBe(getCompetitions);
    expect(rffmCompetitionService.getGroups).toBe(getGroups);
    expect(rffmCompetitionService.updateTeamCompetition).toBe(updateTeamCompetition);
  });
});
