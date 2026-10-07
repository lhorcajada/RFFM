import { describe, expect, it } from "vitest";
import { previousDaysRangeIso } from "../convocationMatchDetail.helpers";

describe("previousDaysRangeIso", () => {
  it("devuelve los 7 días previos al partido, sin incluir el día del partido", () => {
    expect(previousDaysRangeIso("2026-10-10", 7)).toEqual({ from: "2026-10-03", to: "2026-10-09" });
  });

  it("cruza correctamente el cambio de mes", () => {
    expect(previousDaysRangeIso("2026-10-02", 7)).toEqual({ from: "2026-09-25", to: "2026-10-01" });
  });

  it("no se ve afectado por el cambio de hora", () => {
    expect(previousDaysRangeIso("2026-10-28", 7)).toEqual({ from: "2026-10-21", to: "2026-10-27" });
  });
});
