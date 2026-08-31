import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../core/api/client", () => ({
  client: {
    get: vi.fn(),
  },
}));

import { client } from "../../../core/api/client";
import { fetchPublicStorageFile } from "../imageService";

describe("imageService.fetchPublicStorageFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls GET /api/public/storage with the url as a query param and responseType blob", async () => {
    const blob = new Blob(["fake-image"], { type: "image/jpeg" });
    vi.mocked(client.get).mockResolvedValue({ data: blob });

    await fetchPublicStorageFile("newsimages/xyz.jpg");

    expect(client.get).toHaveBeenCalledWith("/api/public/storage", {
      params: { url: "newsimages/xyz.jpg" },
      responseType: "blob",
    });
  });

  it("returns an object URL for the downloaded blob", async () => {
    const blob = new Blob(["fake-image"], { type: "image/jpeg" });
    vi.mocked(client.get).mockResolvedValue({ data: blob });

    const result = await fetchPublicStorageFile("newsimages/xyz.jpg");

    expect(result).toMatch(/^blob:/);
  });

  it("returns null and does not throw when the request fails", async () => {
    vi.mocked(client.get).mockRejectedValue(new Error("network error"));

    const result = await fetchPublicStorageFile("newsimages/missing.jpg");

    expect(result).toBeNull();
  });

  it("returns null without calling the API for an empty url", async () => {
    const result = await fetchPublicStorageFile("");
    expect(result).toBeNull();
    expect(client.get).not.toHaveBeenCalled();
  });
});
