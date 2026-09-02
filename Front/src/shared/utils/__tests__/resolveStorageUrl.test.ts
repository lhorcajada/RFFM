import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../core/api/client", () => ({
  client: { defaults: { baseURL: "https://localhost:7287/" } },
}));

import { resolveStorageUrl } from "../resolveStorageUrl";

describe("resolveStorageUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty string for null/undefined/empty input", () => {
    expect(resolveStorageUrl(null)).toBe("");
    expect(resolveStorageUrl(undefined)).toBe("");
    expect(resolveStorageUrl("")).toBe("");
  });

  it("leaves absolute http(s) URLs untouched (RFFM shields, Supabase public URLs)", () => {
    expect(resolveStorageUrl("https://appweb.rffm.es/escudo.png")).toBe(
      "https://appweb.rffm.es/escudo.png",
    );
    expect(resolveStorageUrl("http://example.com/img.png")).toBe(
      "http://example.com/img.png",
    );
  });

  it("proxies a bare storage relative path through the anonymous team-photo endpoint", () => {
    expect(resolveStorageUrl("teamphotos/abc123.jpg")).toBe(
      "https://localhost:7287/api/catalog/team/photo?url=teamphotos%2Fabc123.jpg",
    );
  });
});
