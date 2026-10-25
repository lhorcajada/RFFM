import { describe, expect, it } from "vitest";
import { formatMatchDay, formatShortDay } from "../matchDates";

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
