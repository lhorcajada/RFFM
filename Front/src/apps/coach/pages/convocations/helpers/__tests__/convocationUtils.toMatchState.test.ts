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
