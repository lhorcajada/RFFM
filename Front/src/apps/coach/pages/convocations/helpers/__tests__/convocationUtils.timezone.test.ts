process.env.TZ = "Europe/Madrid";

import { describe, expect, it } from "vitest";
import { normalizeFromSportEvent } from "../convocationUtils";
import type { SportEventResponse } from "../../../../services/sportEventService";

function baseEvent(overrides: Partial<SportEventResponse> = {}): SportEventResponse {
  return {
    id: "event-1",
    title: "Partido",
    ...overrides,
  };
}

describe("normalizeFromSportEvent - conversión de hora UTC a hora local", () => {
  it("convierte la hora UTC del backend a la hora local del navegador (Europe/Madrid, CEST +2)", () => {
    // 2026-08-31T18:00:00Z en UTC corresponde a las 20:00 en Europe/Madrid (CEST, verano, +2h)
    const event = baseEvent({ eveDateTime: "2026-08-31T18:00:00Z", startTime: "2026-08-31T18:00:00Z" });

    const result = normalizeFromSportEvent(event);

    expect(result.time).toBe("20:00");
  });

  it("muestra la hora aunque la conversión a hora local dé medianoche, si startTime es un valor real", () => {
    // 2026-08-31T22:00:00Z en UTC corresponde a las 00:00 del día siguiente en Europe/Madrid (CEST, +2h)
    const event = baseEvent({ eveDateTime: "2026-08-31T22:00:00Z", startTime: "2026-08-31T22:00:00Z" });

    const result = normalizeFromSportEvent(event);

    expect(result.time).toBe("00:00");
  });

  it("no muestra hora cuando el partido de liga aún no tiene horario publicado (startTime null)", () => {
    // RFFM publica la fecha antes que la hora: eveDateTime lleva la fecha (medianoche UTC de
    // marcador de posición), pero startTime es null hasta que se conoce la hora real.
    const event = baseEvent({ eveDateTime: "2026-08-31T00:00:00Z", startTime: null });

    const result = normalizeFromSportEvent(event);

    expect(result.time).toBe("");
  });
});
