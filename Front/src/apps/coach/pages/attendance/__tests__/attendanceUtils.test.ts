import { describe, expect, it } from "vitest";
import { getDefaultAttendanceDateRange } from "../attendanceUtils";

describe("getDefaultAttendanceDateRange", () => {
  it("usa la fecha de hoy como inicio y el fin de temporada como fin cuando la temporada no ha terminado", () => {
    const today = new Date(2026, 0, 15); // 2026-01-15
    const seasonEndDate = "2026-06-30";

    const range = getDefaultAttendanceDateRange(seasonEndDate, today);

    expect(range).toEqual({ start: "2026-01-15", end: "2026-06-30" });
  });

  it("usa el fin de temporada como fin cuando la fecha de fin coincide exactamente con hoy", () => {
    const today = new Date(2026, 5, 30); // 2026-06-30
    const seasonEndDate = "2026-06-30";

    const range = getDefaultAttendanceDateRange(seasonEndDate, today);

    expect(range).toEqual({ start: "2026-06-30", end: "2026-06-30" });
  });

  it("cae al 31 de diciembre del año actual cuando el fin de temporada ya ha pasado", () => {
    const today = new Date(2026, 8, 1); // 2026-09-01
    const seasonEndDate = "2026-06-30"; // already passed

    const range = getDefaultAttendanceDateRange(seasonEndDate, today);

    expect(range).toEqual({ start: "2026-09-01", end: "2026-12-31" });
  });

  it("cae al 31 de diciembre del año actual cuando no hay temporada seleccionada", () => {
    const today = new Date(2026, 2, 10); // 2026-03-10

    const range = getDefaultAttendanceDateRange(null, today);

    expect(range).toEqual({ start: "2026-03-10", end: "2026-12-31" });
  });

  it("cae al 31 de diciembre del año actual cuando la fecha de fin de temporada es inválida", () => {
    const today = new Date(2026, 2, 10); // 2026-03-10

    const range = getDefaultAttendanceDateRange("not-a-date", today);

    expect(range).toEqual({ start: "2026-03-10", end: "2026-12-31" });
  });
});
