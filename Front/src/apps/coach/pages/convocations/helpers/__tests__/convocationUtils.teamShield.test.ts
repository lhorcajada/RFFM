import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../../core/api/client", () => ({
  client: { defaults: { baseURL: "https://localhost:7287/" } },
}));

import { normalizeFromSportEvent } from "../convocationUtils";
import type { SportEventResponse } from "../../../../services/sportEventService";

function baseEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "event-1",
    title: "Partido",
    isHomeMatch: true,
    rivalPhotoUrl: "https://appweb.rffm.es/escudo-rival.png",
    ...overrides,
  };
}

describe("normalizeFromSportEvent - escudo del equipo propio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("proxya el escudo propio cuando es una ruta relativa de almacenamiento local", () => {
    const event = baseEvent({ teamPhotoUrl: "teamphotos/abc123.jpg" });

    const result = normalizeFromSportEvent(event);

    expect(result.localTeamShield).toBe(
      "https://localhost:7287/api/catalog/team/photo?url=teamphotos%2Fabc123.jpg",
    );
  });

  it("deja intacta una URL absoluta del escudo propio (p.ej. Supabase)", () => {
    const event = baseEvent({
      teamPhotoUrl: "https://storage.supabase.co/teamphotos/abc123.jpg",
    });

    const result = normalizeFromSportEvent(event);

    expect(result.localTeamShield).toBe(
      "https://storage.supabase.co/teamphotos/abc123.jpg",
    );
  });

  it("no rompe cuando el equipo aún no tiene escudo", () => {
    const event = baseEvent({ teamPhotoUrl: null });

    const result = normalizeFromSportEvent(event);

    expect(result.localTeamShield).toBe("");
  });
});
