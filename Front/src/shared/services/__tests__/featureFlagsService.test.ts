import { beforeEach, describe, expect, it, vi } from "vitest";
import { client } from "../../../core/api/client";
import { FEATURE_FLAGS, getFeatureFlags } from "../featureFlagsService";

vi.mock("../../../core/api/client");

describe("featureFlagsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getFeatureFlags consulta /api/feature-flags sin redirigir en error y devuelve el mapa", async () => {
    const mockGet = vi.fn().mockResolvedValue({ data: { QuinielaMultipleTickets: true } });
    (client.get as unknown) = mockGet;

    const flags = await getFeatureFlags();

    expect(mockGet).toHaveBeenCalledWith("/api/feature-flags", { suppressErrorRedirect: true });
    expect(flags).toEqual({ QuinielaMultipleTickets: true });
  });

  it("FEATURE_FLAGS usa el mismo nombre que el catálogo del backend", () => {
    expect(FEATURE_FLAGS.QuinielaMultipleTickets).toBe("QuinielaMultipleTickets");
  });
});
