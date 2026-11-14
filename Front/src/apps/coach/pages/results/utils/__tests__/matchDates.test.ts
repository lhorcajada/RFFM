import { describe, expect, it } from "vitest";
import { compareByKickoff, formatMatchDay, formatShortDay } from "../matchDates";

describe("formatMatchDay", () => {
  it("formatea fechas dd-MM-yyyy e ISO como «Dom 4 oct»", () => {
    expect(formatMatchDay("04-10-2026")).toBe("Dom 4 oct");
    expect(formatMatchDay("2026-10-03T00:00:00")).toBe("Sáb 3 oct");
  });

  it("devuelve cadena vacía sin fecha válida", () => {
    expect(formatMatchDay("")).toBe("");
    expect(formatMatchDay("no-fecha")).toBe("");
  });
});

describe("formatShortDay", () => {
  it("formatea como día/mes", () => {
    expect(formatShortDay("01/11/2026")).toBe("1/11");
  });
});

describe("compareByKickoff", () => {
  const at = (date: string, time: string) => ({ date, time });
  const sorted = (list: { date: string; time: string }[]) => [...list].sort(compareByKickoff);

  it("ordena por día y, dentro del día, por hora", () => {
    const list = [at("15-11-2026", "10:30"), at("14-11-2026", "13:25"), at("15-11-2026", "09:00"), at("14-11-2026", "11:00")];
    expect(sorted(list)).toEqual([
      at("14-11-2026", "11:00"),
      at("14-11-2026", "13:25"),
      at("15-11-2026", "09:00"),
      at("15-11-2026", "10:30"),
    ]);
  });

  it("mezcla fechas dd-MM-yyyy e ISO", () => {
    expect(sorted([at("2026-11-15T00:00:00", "09:00"), at("14-11-2026", "18:00")])[0]).toEqual(at("14-11-2026", "18:00"));
  });

  it("deja al final los partidos sin fecha y sin hora, y sin hora tras los del mismo día con hora", () => {
    const list = [at("", ""), at("14-11-2026", ""), at("14-11-2026", "10:00")];
    expect(sorted(list)).toEqual([at("14-11-2026", "10:00"), at("14-11-2026", ""), at("", "")]);
  });
});
