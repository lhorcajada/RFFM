import { describe, it, expect } from "vitest";
import { groupMatchesByWeekend } from "../calendar";

const match = (fecha: string, local = "Local", visitante = "Visitante") => ({
  fecha,
  equipo_local: local,
  equipo_visitante: visitante,
});

describe("groupMatchesByWeekend", () => {
  it("agrupa en aplazados un partido movido a un miércoles", () => {
    const grouped = groupMatchesByWeekend([
      match("04-10-2025"),
      match("05-10-2025"),
      match("08-10-2025"),
    ]);

    expect(grouped.postponed.map((i) => i.rawDate)).toEqual(["08-10-2025"]);
  });

  it("agrupa en aplazados un partido movido al sábado de otro fin de semana", () => {
    const grouped = groupMatchesByWeekend([
      match("04-10-2025"),
      match("04-10-2025"),
      match("05-10-2025"),
      match("25-10-2025"),
    ]);

    expect(grouped.saturday.map((i) => i.rawDate)).toEqual([
      "04-10-2025",
      "04-10-2025",
    ]);
    expect(grouped.postponed.map((i) => i.rawDate)).toEqual(["25-10-2025"]);
  });

  it("mantiene en descansos los equipos que descansan aunque tengan otra fecha", () => {
    const grouped = groupMatchesByWeekend([
      match("04-10-2025"),
      match("08-10-2025", "Descansa", "CD Equipo"),
    ]);

    expect(grouped.byes).toHaveLength(1);
    expect(grouped.postponed).toHaveLength(0);
  });
});
