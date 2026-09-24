import { describe, expect, it } from "vitest";
import { attributableAbsenceLine, minutesTargetVerdict } from "../playerStatsText";
import type { AttributableAbsence } from "../../../services/teamPlayerStatisticsService";

const absence = (overrides: Partial<AttributableAbsence> = {}): AttributableAbsence => ({
  eventId: "m1",
  date: "2026-10-12T17:00:00Z",
  eventTypeId: 1,
  opponent: "CD Rival",
  matchMinutes: 80,
  kind: "Declined",
  reason: "Lesión",
  ...overrides,
});

describe("minutesTargetVerdict", () => {
  it("cumple el objetivo", () => {
    expect(minutesTargetVerdict({ minutesTargetStatus: "Met", minutesPlayedPercentOfAvailable: 32.5 })).toBe(
      "Cumple el objetivo",
    );
  });

  it("no llega por sus ausencias, con el % sobre sus minutos disponibles", () => {
    expect(
      minutesTargetVerdict({ minutesTargetStatus: "NotMetByOwnAbsences", minutesPlayedPercentOfAvailable: 41.7 }),
    ).toBe("No llega por sus ausencias: 42% de sus minutos disponibles");
  });

  it("no llega por sus ausencias cuando no ha acudido a ningún partido", () => {
    expect(
      minutesTargetVerdict({ minutesTargetStatus: "NotMetByOwnAbsences", minutesPlayedPercentOfAvailable: null }),
    ).toBe("No llega por sus ausencias: no ha acudido a ningún partido");
  });

  it("no llega al objetivo sobre sus minutos disponibles", () => {
    expect(minutesTargetVerdict({ minutesTargetStatus: "NotMet", minutesPlayedPercentOfAvailable: 18.8 })).toBe(
      "No llega al objetivo: 19% de sus minutos disponibles",
    );
  });

  it("sin veredicto devuelve null", () => {
    expect(minutesTargetVerdict({ minutesTargetStatus: null, minutesPlayedPercentOfAvailable: null })).toBeNull();
  });
});

describe("attributableAbsenceLine", () => {
  it("rechazo con motivo: fecha, tipo y rival, minutos, tipo de ausencia y motivo", () => {
    expect(attributableAbsenceLine(absence())).toBe("12/10 · Liga vs CD Rival · 80' · Rechazó la convocatoria · Lesión");
  });

  it("no presentado sin motivo ni minutos (categoría sin objetivo)", () => {
    expect(
      attributableAbsenceLine(absence({ eventTypeId: 4, opponent: "Torneo verano", matchMinutes: 0, kind: "NoShow", reason: null })),
    ).toBe("12/10 · Amistoso vs Torneo verano · No se presentó");
  });
});
