import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../core/api/client", () => ({
  __esModule: true,
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import client from "../../../../core/api/client";
import { deleteSavedProposal, getSavedProposals, saveProposal } from "../deconvocationProposalService";

const saved = { id: "s1", name: "Propuesta 1", teamPlayerIds: ["p1"], createdOn: "2026-11-27T10:00:00Z" };

describe("deconvocationProposalService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("lee las propuestas guardadas del partido", async () => {
    vi.mocked(client.get).mockResolvedValue({ data: { items: [saved] } });

    const result = await getSavedProposals("e 1");

    expect(client.get).toHaveBeenCalledWith("/api/events/e%201/deconvocation-proposals");
    expect(result).toEqual([saved]);
  });

  it("guarda una propuesta", async () => {
    vi.mocked(client.post).mockResolvedValue({ data: saved });

    const result = await saveProposal("e1", "Propuesta 1", ["p1"]);

    expect(client.post).toHaveBeenCalledWith("/api/events/e1/deconvocation-proposals", {
      name: "Propuesta 1",
      teamPlayerIds: ["p1"],
    });
    expect(result).toEqual(saved);
  });

  it("borra una propuesta", async () => {
    vi.mocked(client.delete).mockResolvedValue({});

    await deleteSavedProposal("e1", "s 1");

    expect(client.delete).toHaveBeenCalledWith("/api/events/e1/deconvocation-proposals/s%201");
  });
});
