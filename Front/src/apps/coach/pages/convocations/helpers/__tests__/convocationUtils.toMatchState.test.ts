import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../../../../../core/api/client", () => ({
  client: { defaults: { baseURL: "https://localhost:7287/" } },
}));

import { toMatchState } from "../convocationUtils";
import type { SportEventResponse } from "../../../../services/sportEventService";

function baseEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "event-1",
    title: "Partido",
    isHomeMatch: true,
    ...overrides,
  };
}

describe("toMatchState - incluye el eventId del partido de origen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rellena eventId con el id del SportEventResponse", () => {
    const event = baseEvent({ id: "event-42" });

    const result = toMatchState(event);

    expect(result.eventId).toBe("event-42");
  });

  it("rellena eventId a null cuando el evento no trae id", () => {
    const event = baseEvent({ id: undefined as unknown as string });

    const result = toMatchState(event);

    expect(result.eventId).toBeNull();
  });
});

describe("toMatchState - resuelve el escudo del rival igual que el del propio equipo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resuelve una ruta relativa de rivalPhotoUrl a través del proxy de almacenamiento (partido en casa)", () => {
    const event = baseEvent({
      isHomeMatch: true,
      rivalName: "Parla escuela",
      rivalPhotoUrl: "rivalphotos/e656b786-6c53-4e01-a77a-7c00c7f162fb.jpg",
    });

    const result = toMatchState(event);

    expect(result.visitorTeamShield).toBe(
      "https://localhost:7287/api/catalog/team/photo?url=" +
        encodeURIComponent("rivalphotos/e656b786-6c53-4e01-a77a-7c00c7f162fb.jpg"),
    );
  });

  it("deja intacta una rivalPhotoUrl que ya es una URL absoluta", () => {
    const event = baseEvent({
      isHomeMatch: true,
      rivalPhotoUrl: "https://cdn.example.com/rival.png",
    });

    const result = toMatchState(event);

    expect(result.visitorTeamShield).toBe("https://cdn.example.com/rival.png");
  });

  it("resuelve el escudo del rival cuando juega como visitante (el rival pasa a ser el equipo local)", () => {
    const event = baseEvent({
      isHomeMatch: false,
      rivalPhotoUrl: "rivalphotos/away.jpg",
    });

    const result = toMatchState(event);

    expect(result.localTeamShield).toBe(
      "https://localhost:7287/api/catalog/team/photo?url=" + encodeURIComponent("rivalphotos/away.jpg"),
    );
  });
});
