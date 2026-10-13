import { describe, expect, it } from "vitest";
import { leagueAbsenceLine, leagueAbsenceReason, matchAbsenceLines } from "../playerStatsText";
import type { AttributableAbsence, LeagueAbsence } from "../../../services/teamPlayerStatisticsService";

const leagueAbsence = (overrides: Partial<LeagueAbsence> = {}): LeagueAbsence => ({
  eventId: "l1",
  date: "2026-10-12T17:00:00Z",
  opponent: "CD Rival",
  kind: "Unavailable",
  reason: "Lesión",
  ...overrides,
});

const attributableAbsence = (overrides: Partial<AttributableAbsence> = {}): AttributableAbsence => ({
  eventId: "f1",
  date: "2026-10-05T17:00:00Z",
  eventTypeId: 4,
  opponent: "UD Vecina",
  matchMinutes: 70,
  kind: "NoShow",
  reason: null,
  ...overrides,
});

describe("leagueAbsenceReason", () => {
  it("no disponible por lesión", () => {
    expect(leagueAbsenceReason(leagueAbsence())).toBe("No asistió porque no estaba disponible por lesión");
  });

  it("no disponible por evento familiar", () => {
    expect(leagueAbsenceReason(leagueAbsence({ reason: "Evento familiar" }))).toBe(
      "No asistió porque no estaba disponible por evento familiar",
    );
  });

  it("no disponible sin motivo registrado", () => {
    expect(leagueAbsenceReason(leagueAbsence({ reason: null }))).toBe("No asistió porque no estaba disponible");
  });

  it("descartado por el entrenador", () => {
    expect(leagueAbsenceReason(leagueAbsence({ kind: "TechnicalDecision", reason: "Decisión técnica" }))).toBe(
      "No asistió por decisión técnica",
    );
  });

  it("convocado que no se presentó", () => {
    expect(leagueAbsenceReason(leagueAbsence({ kind: "NoShow", reason: null }))).toBe(
      "No asistió estando convocado",
    );
  });

  it("convocado que no se presentó, con motivo", () => {
    expect(leagueAbsenceReason(leagueAbsence({ kind: "NoShow", reason: "Enfermedad" }))).toBe(
      "No asistió estando convocado (enfermedad)",
    );
  });
});

describe("leagueAbsenceLine", () => {
  it("fecha, rival y motivo", () => {
    expect(leagueAbsenceLine(leagueAbsence())).toBe(
      "12/10 · Liga vs CD Rival · No asistió porque no estaba disponible por lesión",
    );
  });
});

describe("matchAbsenceLines", () => {
  it("une las ausencias de liga y las imputables del resto de partidos, más reciente primero", () => {
    const lines = matchAbsenceLines({
      leagueAbsences: [leagueAbsence()],
      attributableAbsences: [attributableAbsence()],
    });

    expect(lines).toEqual([
      "12/10 · Liga vs CD Rival · No asistió porque no estaba disponible por lesión",
      "05/10 · Amistoso vs UD Vecina · 70' · No se presentó",
    ]);
  });

  it("no repite los partidos de liga que también son ausencia imputable", () => {
    const lines = matchAbsenceLines({
      leagueAbsences: [leagueAbsence()],
      attributableAbsences: [attributableAbsence({ eventId: "l1", date: "2026-10-12T17:00:00Z", eventTypeId: 1, opponent: "CD Rival" })],
    });

    expect(lines).toEqual(["12/10 · Liga vs CD Rival · No asistió porque no estaba disponible por lesión"]);
  });
});
